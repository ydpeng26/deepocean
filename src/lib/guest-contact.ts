import { getSupabaseProjectUrl } from "@/integrations/supabase/client";
export class ContactError extends Error {
  constructor(public code: "invalid" | "rate" | "conflict" | "save") {
    super(code);
  }
}
export type ContactInput = { category: string; body: string; reply_email: string; website: string };
export function validateContact(input: ContactInput) {
  const body = input.body.trim(),
    reply_email = input.reply_email.trim();
  if (
    !["suggestion", "issue", "other"].includes(input.category) ||
    !body ||
    body.length > 3000 ||
    input.website ||
    (reply_email !== "" &&
      (reply_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply_email)))
  )
    throw new ContactError("invalid");
  return { category: input.category, body, reply_email, website: "" };
}
export function contactVisitorKey() {
  const key = "supdiver-contact-visitor-v1";
  try {
    const prior = localStorage.getItem(key);
    if (prior && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prior))
      return prior;
    const value = crypto.randomUUID();
    localStorage.setItem(key, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}
export async function sendGuestContact(id: string, visitor_key: string, input: ContactInput) {
  const value = validateContact(input);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(id) || !uuid.test(visitor_key)) throw new ContactError("invalid");
  try {
    // Deliberately no auth client/session/storage dependency or user credentials.
    const response = await fetch(getSupabaseProjectUrl() + "/functions/v1/guest-contact", {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visitor_key, ...value }),
    });
    const result = await response.json().catch(() => null);
    if (response.status === 429) throw new ContactError("rate");
    if (response.status === 409) throw new ContactError("conflict");
    if (!response.ok || result?.code !== "received" || result?.id !== id.toLowerCase())
      throw new ContactError("save");
    return result.id as string;
  } catch (error) {
    if (error instanceof ContactError) throw error;
    throw new ContactError("save");
  }
}
