import { supabase } from "@/integrations/supabase/client";

export type FeedbackCategory = "suggestion" | "issue" | "other";
export type FeedbackInput = { category: FeedbackCategory; body: string };
export class FeedbackError extends Error {
  constructor(public code: "invalid" | "account" | "conflict" | "rate" | "save") {
    super(code);
    this.name = "FeedbackError";
  }
}
export function validateFeedback(input: FeedbackInput): FeedbackInput {
  if (
    !["suggestion", "issue", "other"].includes(input.category) ||
    typeof input.body !== "string" ||
    !input.body.trim() ||
    input.body.trim().length > 3000
  )
    throw new FeedbackError("invalid");
  return { category: input.category, body: input.body.trim() };
}
async function owner(expected: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !expected || data.session?.user.id !== expected) throw new FeedbackError("account");
}
// Stable request id makes a lost-response retry confirm the original submission,
// never overwrite it or silently publish the user's subsequently changed text.
export async function submitFeedback(id: string, input: FeedbackInput, expectedUser: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new FeedbackError("invalid");
  const values = validateFeedback(input);
  await owner(expectedUser);
  const payload = { id, user_id: expectedUser, ...values };
  const columns = "id,user_id,category,body";
  const confirm = (row: { id: string; user_id: string; category: string; body: string } | null) => {
    if (
      !row ||
      Object.entries(payload).some(([key, value]) => row[key as keyof typeof row] !== value)
    )
      throw new FeedbackError("conflict");
    return row.id;
  };
  const prior = async () => {
    const result = await supabase
      .from("website_feedback")
      .select(columns)
      .eq("id", id)
      .eq("user_id", expectedUser)
      .maybeSingle();
    await owner(expectedUser);
    if (result.error) throw new FeedbackError("save");
    return result.data;
  };
  const existing = await prior();
  if (existing) return confirm(existing);
  await owner(expectedUser);
  const result = await supabase.from("website_feedback").insert(payload).select(columns).single();
  await owner(expectedUser);
  if (result.error) {
    const committed = await prior();
    if (committed) return confirm(committed);
    throw new FeedbackError(result.error.message === "feedback_rate_limit" ? "rate" : "save");
  }
  return confirm(result.data);
}
