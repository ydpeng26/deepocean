import type { SupabaseClient } from "@supabase/supabase-js";
import { safeAuthReturn } from "@/lib/auth-return";
import { googleOAuthKeys } from "@/lib/google-oauth-keys";
import { completeOAuthSession } from "@/lib/oauth-session";

type Auth = SupabaseClient["auth"];
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Transaction = { id: string; at: number; next: string; owner: string | null };
export function createGoogleOAuthFlow(deps: {
  main: Pick<Auth, "getSession" | "setSession">;
  oauth: Pick<Auth, "signInWithOAuth" | "exchangeCodeForSession" | "stopAutoRefresh">;
  storage: Storage;
  available: () => boolean;
  projectUrl: string;
  origin: string;
  onCallback: () => boolean;
  now?: () => number;
  nonce?: () => string;
}) {
  const keys = googleOAuthKeys(deps.projectUrl);
  const now = deps.now ?? Date.now;
  let pendingStart: Promise<string> | undefined;
  let completion: { code: string; promise: Promise<string> } | undefined;
  const failure = () => new Error("Google OAuth could not be completed. Please start again.");
  function read(): Transaction | null {
    try {
      const raw = deps.storage.getItem(keys.transaction);
      if (!raw) return null;
      const value = JSON.parse(raw) as Transaction;
      if (
        typeof value.id !== "string" ||
        !value.id ||
        typeof value.at !== "number" ||
        !Number.isFinite(value.at) ||
        value.at > now() ||
        now() - value.at > 10 * 60 * 1000 ||
        safeAuthReturn(value.next) !== value.next ||
        !(value.owner === null || typeof value.owner === "string")
      )
        return null;
      return value;
    } catch {
      return null;
    }
  }
  async function clean(id?: string) {
    // A late completion must never delete a newer attempt's verifier.
    const current = read();
    if (id && current && current.id !== id) return;
    let failed = false;
    for (const key of [keys.transaction, keys.verifier, keys.session, keys.user]) {
      try {
        deps.storage.removeItem(key);
      } catch {
        failed = true;
      }
    }
    try {
      await deps.oauth.stopAutoRefresh();
    } catch {
      failed = true;
    }
    if (failed || !deps.available()) throw failure();
  }
  async function owner() {
    const result = await deps.main.getSession();
    if (result.error) throw failure();
    return result.data.session?.user.id ?? null;
  }
  async function startInner(destination?: string) {
    let id: string | undefined;
    try {
      if (!deps.available()) throw failure();
      await clean();
      const initialOwner = await owner();
      id = (deps.nonce ?? (() => crypto.randomUUID()))();
      const next = safeAuthReturn(destination) ?? "/dives";
      deps.storage.setItem(
        keys.transaction,
        JSON.stringify({ id, at: now(), next, owner: initialOwner }),
      );
      const redirectTo = new URL("/oauth-callback", deps.origin).href;
      const result = await deps.oauth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (result.error || !result.data.url) throw failure();
      const url = new URL(result.data.url);
      if (
        url.origin !== new URL(deps.projectUrl).origin ||
        url.pathname !== "/auth/v1/authorize" ||
        url.searchParams.get("provider") !== "google" ||
        url.searchParams.get("redirect_to") !== redirectTo ||
        url.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256" ||
        !url.searchParams.get("code_challenge") ||
        !deps.storage.getItem(keys.verifier) ||
        read()?.id !== id ||
        !deps.available()
      )
        throw failure();
      return url.href;
    } catch {
      try {
        await clean(id);
      } catch {
        /* Fail closed; never clear unrelated storage. */
      }
      throw failure();
    }
  }
  function start(destination?: string) {
    if (completion) return Promise.reject(failure());
    if (!pendingStart)
      pendingStart = startInner(destination).finally(() => {
        pendingStart = undefined;
      });
    return pendingStart;
  }
  async function finishInner(code: string, providerError: boolean) {
    const transaction = read();
    try {
      if (
        !deps.available() ||
        !transaction ||
        providerError ||
        !code ||
        code.length > 2048 ||
        !deps.storage.getItem(keys.verifier) ||
        !deps.onCallback() ||
        (await owner()) !== transaction.owner
      )
        throw failure();
      // Consume the attempt before exchange. React effect replay shares the
      // in-flight promise; a fresh reload cannot reuse the attempt/code.
      deps.storage.removeItem(keys.transaction);
      const result = await deps.oauth.exchangeCodeForSession(code);
      const session = result.data.session;
      if (
        result.error ||
        !session?.user.id ||
        !deps.available() ||
        !deps.onCallback() ||
        (await owner()) !== transaction.owner
      )
        throw failure();
      const isGoogle =
        session.user.app_metadata?.provider === "google" ||
        session.user.app_metadata?.providers?.includes("google") ||
        session.user.identities?.some((identity) => identity.provider === "google");
      if (!isGoogle) throw failure();
      const saved = await completeOAuthSession(
        {
          tokens: { access_token: session.access_token, refresh_token: session.refresh_token },
          error: null,
        },
        (tokens) => deps.main.setSession(tokens),
      );
      if (saved.error || !deps.onCallback() || (await owner()) !== session.user.id) throw failure();
      return transaction.next;
    } catch {
      throw failure();
    } finally {
      await clean(transaction?.id);
    }
  }
  function finish(code: string, providerError = false) {
    if (pendingStart) return Promise.reject(failure());
    if (completion)
      return completion.code === code ? completion.promise : Promise.reject(failure());
    const promise = finishInner(code, providerError).finally(() => {
      completion = undefined;
    });
    completion = { code, promise };
    return promise;
  }
  return { start, finish };
}
