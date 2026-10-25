import { supabase, emailConfirmation, getSupabaseProjectUrl } from "@/integrations/supabase/client";
import { authStorageAvailable, getTabAuthStorage, guardTabAuthWrite } from "@/lib/tab-auth-storage";
import { emailConfirmationKeys } from "@/lib/email-confirmation-keys";
import { createEmailConfirmationFlow } from "@/lib/email-confirmation-flow";

// Do not let a newly mounted confirmation overlap the SDK's still-pending
// one-use request and shared temporary key. Effect replay shares its task.
let pending = false;

export function createBrowserEmailConfirmation(active: () => boolean, invalidate: () => void) {
  const storage = getTabAuthStorage();
  if (!storage || !authStorageAvailable())
    throw new Error("Email confirmation storage unavailable");
  const keys = emailConfirmationKeys(getSupabaseProjectUrl());
  const temporary = [keys.session, keys.user, keys.verifier];
  const flow = createEmailConfirmationFlow({
    main: supabase.auth,
    confirmation: emailConfirmation.auth,
    active,
    invalidate,
    available: () => authStorageAvailable(),
    saveBoundSession: async (tokens, current, initialOwner, verifiedOwner) => {
      const release = guardTabAuthWrite((key, value) => {
        if (key !== keys.mainSession) return true;
        try {
          const candidate = JSON.parse(value);
          if (
            candidate?.access_token !== tokens.access_token &&
            candidate?.user?.id !== verifiedOwner
          )
            return true;
          const stored = JSON.parse(storage.getItem(keys.mainSession) ?? "null");
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
      for (const key of temporary) {
        try {
          window.sessionStorage.removeItem(key);
        } catch {
          failed = true;
        }
      }
      if (failed) throw new Error("Email confirmation cleanup unavailable");
    },
    prepareCode: () => {
      const original = storage.getItem(keys.mainVerifier);
      if (!original) throw new Error("Email confirmation verifier unavailable");
      storage.setItem(keys.verifier, original);
      return () => {
        // Consume only the verifier copied for this one-use request; never a
        // newer attempt's verifier or an unrelated auth/draft storage key.
        if (window.sessionStorage.getItem(keys.mainVerifier) === original)
          window.sessionStorage.removeItem(keys.mainVerifier);
      };
    },
  });
  return {
    ...flow,
    run(input: Parameters<typeof flow.run>[0]) {
      if (pending) return Promise.reject(new Error("Email confirmation is already pending"));
      pending = true;
      return flow.run(input).finally(() => {
        pending = false;
      });
    },
  };
}
