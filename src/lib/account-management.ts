import { supabase } from "@/integrations/supabase/client";

export type AccountDeletionState = {
  id: string;
  code: "none" | "pending" | "completed" | "reauth";
};
export async function accountDeletion(
  action: "status" | "delete",
  id: string,
  expectedOwner: string,
) {
  const before = await supabase.auth.getSession();
  if (before.error || before.data.session?.user.id !== expectedOwner) throw Error("account");
  const result = await supabase.functions.invoke("delete-account", {
    body: { action, request_id: id, confirmation: action === "delete" ? "DELETE MY ACCOUNT" : "" },
  });
  let receipt = result.data;
  // Supabase wraps non-2xx function replies; read only the fixed safe receipt.
  if (result.error && "context" in result.error && result.error.context instanceof Response) {
    try {
      receipt = await result.error.context.json();
    } catch {
      throw Error("unavailable");
    }
  }
  if (
    !receipt ||
    typeof receipt.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.id) ||
    !(action === "status" ? ["none", "pending"] : ["pending", "completed", "reauth"]).includes(
      receipt.code,
    ) ||
    (receipt.code === "completed" && !!result.error) ||
    (receipt.code === "none" && receipt.id !== id)
  )
    throw Error("unavailable");
  const after = await supabase.auth.getSession();
  if (after.error || after.data.session?.user.id !== expectedOwner) throw Error("account");
  if (receipt.code === "completed" && receipt.id !== id) throw Error("receipt");
  return receipt as AccountDeletionState;
}
