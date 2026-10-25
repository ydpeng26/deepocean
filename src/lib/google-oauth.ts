import { supabase, googleOAuth, getSupabaseProjectUrl } from "@/integrations/supabase/client";
import { getTabAuthStorage, authStorageAvailable } from "@/lib/tab-auth-storage";
import { createGoogleOAuthFlow } from "@/lib/google-oauth-flow";

let flow: ReturnType<typeof createGoogleOAuthFlow> | undefined;
function getFlow() {
  if (!flow) {
    const storage = getTabAuthStorage();
    if (!storage || !authStorageAvailable(true))
      throw new Error("Google OAuth storage unavailable");
    flow = createGoogleOAuthFlow({
      main: supabase.auth,
      oauth: googleOAuth.auth,
      storage,
      available: () => authStorageAvailable(true),
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
