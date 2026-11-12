import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type InboxStatus = "unread" | "read" | "resolved";
export type InboxSource = "member" | "guest";
export type InboxMessage = Database["public"]["Views"]["feedback_inbox"]["Row"];
export const INBOX_PAGE_SIZE = 20;
export class InboxError extends Error {
  constructor(public code: "account" | "denied" | "load" | "conflict" | "save") {
    super(code);
  }
}
async function checkAccount(expected: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !expected || data.session?.user.id !== expected) throw new InboxError("account");
}
export async function isFeedbackAdmin(expected: string) {
  await checkAccount(expected);
  const result = await supabase.rpc("is_feedback_admin");
  await checkAccount(expected);
  if (result.error) throw new InboxError("load");
  return result.data === true;
}
export async function loadInbox(
  expected: string,
  filter: {
    status: InboxStatus | "all";
    source: InboxSource | "all";
    page: number;
    search: string;
  },
) {
  if (!(await isFeedbackAdmin(expected))) throw new InboxError("denied");
  if (!Number.isInteger(filter.page) || filter.page < 0 || filter.page > 100000)
    throw new InboxError("load");
  let query = supabase
    .from("feedback_inbox")
    .select("source,id,user_id,category,body,reply_email,created_at,status", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("source")
    .order("id");
  if (filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.source !== "all") query = query.eq("source", filter.source);
  const search = filter.search.trim().slice(0, 120);
  if (search) query = query.ilike("body", "%" + search.replace(/[\\%_]/g, "\\$&") + "%");
  const result = await query.range(
    filter.page * INBOX_PAGE_SIZE,
    (filter.page + 1) * INBOX_PAGE_SIZE - 1,
  );
  await checkAccount(expected);
  if (result.error || !result.data) throw new InboxError("load");
  return { messages: result.data, total: result.count ?? 0 };
}
export async function setInboxStatus(expected: string, message: InboxMessage, status: InboxStatus) {
  if (
    !["member", "guest"].includes(message.source) ||
    !["unread", "read", "resolved"].includes(status)
  )
    throw new InboxError("save");
  if (!(await isFeedbackAdmin(expected))) throw new InboxError("denied");
  const table = message.source === "member" ? "website_feedback" : "guest_contact_messages";
  const result = await supabase
    .from(table)
    .update({ status })
    .eq("id", message.id)
    .eq("status", message.status)
    .select("id,status")
    .maybeSingle();
  await checkAccount(expected);
  if (result.error) throw new InboxError("save");
  if (!result.data) throw new InboxError("conflict");
  if (result.data.id !== message.id || result.data.status !== status) throw new InboxError("save");
}
