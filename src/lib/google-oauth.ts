import { supabase, googleOAuth, getSupabaseProjectUrl } from "@/integrations/supabase/client";
import { getTabAuthStorage, authStorageAvailable } from "@/lib/tab-auth-storage";
import { createGoogleOAuthFlow } from "@/lib/google-oauth-flow";
import { googleOAuthKeys } from "@/lib/google-oauth-keys";

let flow: ReturnType<typeof createGoogleOAuthFlow> | undefined;
function getFlow() {
  if (!flow) {
    const storage = getTabAuthStorage();
    if (!storage || !authStorageAvailable(true))
      throw new Error("Google OAuth storage unavailable");
    const temporaryKeys = new Set(Object.values(googleOAuthKeys(getSupabaseProjectUrl())));
    flow = createGoogleOAuthFlow({
      main: supabase.auth,
      oauth: googleOAuth.auth,
      storage,
      available: () => authStorageAvailable(),
      removeTemporaryKey: (key) => {
        // Try removing only our temporary keys even when writes are blocked.
        // Never reset the blocked latch by probing or touch main auth/drafts.
        if (!temporaryKeys.has(key)) throw new Error("Unexpected OAuth cleanup key");
        window.sessionStorage.removeItem(key);
      },
      projectUrl: getSupabaseProjectUrl(),
      origin: window.location.origin,
      onCallback: () => window.location.pathname === "/oauth-callback",
    });
  }
  return flow;
}
export async function beginGoogleOAuth(destination?: string) {
  try {
    let next: string | undefined;
    if (destination) {
      const url = new URL(destination, window.location.origin);
      if (url.origin === window.location.origin) next = url.pathname + url.search + url.hash;
    }
    const url = await getFlow().start(next);
    window.location.assign(url);
    return { redirected: true as const, error: null };
  } catch {
    return { error: new Error("Google OAuth could not be started. Please retry.") };
  }
}
export function finishGoogleOAuth(code: string, providerError: boolean) {
  return getFlow().finish(code, providerError);
}
