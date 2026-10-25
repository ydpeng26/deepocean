import type { OAuthTokens, SignInWithOAuthResult } from "@lovable.dev/cloud-auth-js";

type SaveSession = (tokens: OAuthTokens) => Promise<{
  data: { session: { user: { id: string } } | null };
  error: unknown;
}>;

// Keep provider redirects intact. Non-redirected completion must actually save
// a usable session, including SDK errors returned as values rather than throws.
export async function completeOAuthSession(
  result: SignInWithOAuthResult,
  saveSession: SaveSession,
): Promise<SignInWithOAuthResult> {
  const failed = (): SignInWithOAuthResult => ({
    error: new Error("OAuth session could not be established. Please retry."),
  });
  if (!result || typeof result !== "object") return failed();
  if (result.redirected || result.error) return result;
  try {
    const tokens = result.tokens;
    if (
      typeof tokens?.access_token !== "string" ||
      !tokens.access_token.trim() ||
      typeof tokens.refresh_token !== "string" ||
      !tokens.refresh_token.trim()
    )
      return failed();
    const saved = await saveSession(tokens);
    if (
      saved?.error ||
      typeof saved?.data?.session?.user?.id !== "string" ||
      !saved.data.session.user.id.trim()
    )
      return failed();
    return result;
  } catch {
    // Provider/SDK details may contain credentials; the UI uses translated copy.
    return failed();
  }
}
