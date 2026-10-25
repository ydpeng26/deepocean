import { supabase, passwordRecovery, getSupabaseProjectUrl } from "@/integrations/supabase/client";
import { getTabAuthStorage, authStorageAvailable, guardTabAuthWrite } from "@/lib/tab-auth-storage";
import { createRecoveryFlow } from "@/lib/password-recovery-flow";
import { recoveryKeys } from "@/lib/password-recovery-keys";
let pending = false;
export function createBrowserRecovery(
  active: () => boolean,
  invalidate: () => void,
  expectedLogout: () => boolean,
) {
  const storage = getTabAuthStorage();
  if (!storage || !authStorageAvailable()) throw new Error("Password recovery storage unavailable");
  const keys = recoveryKeys(getSupabaseProjectUrl());
  const flow = createRecoveryFlow({
    main: supabase.auth,
    recovery: passwordRecovery.auth,
    active,
    invalidate,
    expectedLogout,
    available: () => authStorageAvailable(),
    save: async (tokens, current, initialOwner, verifiedOwner) => {
      const release = guardTabAuthWrite((key, value) => {
        if (key !== keys.mainSession) return true;
        try {
          const candidate = JSON.parse(value);
          if (
            candidate?.access_token !== tokens.access_token &&
            candidate?.user?.id !== verifiedOwner
          )
            return true;
          const stored = JSON.parse(storage.getItem(key) ?? "null");
          return current() && (stored?.user?.id ?? null) === initialOwner;
        } catch {
          return false;
        }
      });
      try {
        return await supabase.auth.setSession(tokens);
      } finally {
        release();
      }
    },
    cleanup: () => {
      let failed = false;
      for (const key of [keys.session, keys.user, keys.verifier]) {
        try {
          window.sessionStorage.removeItem(key);
        } catch {
          failed = true;
        }
      }
      if (failed) throw new Error("Password recovery cleanup unavailable");
    },
    prepareCode: () => {
      const original = storage.getItem(keys.mainVerifier);
      if (!original) throw new Error("Password recovery verifier unavailable");
      storage.setItem(keys.verifier, original);
      return () => {
        if (window.sessionStorage.getItem(keys.mainVerifier) === original)
          window.sessionStorage.removeItem(keys.mainVerifier);
      };
    },
  });
  return {
    ...flow,
    run(input: Parameters<typeof flow.run>[0]) {
      if (pending) return Promise.reject(new Error("Password recovery is already pending"));
      pending = true;
      return flow.run(input).finally(() => {
        pending = false;
      });
    },
  };
}
