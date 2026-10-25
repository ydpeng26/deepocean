import type { SupabaseClient } from "@supabase/supabase-js";
type Auth = SupabaseClient["auth"];
export type EmailConfirmationInput =
  | { kind: "invalid" }
  | { kind: "hash"; value: string }
  | { kind: "code"; value: string }
  | { kind: "tokens"; access_token: string; refresh_token: string };
export function emailConfirmationInput(search: string, fragment: string): EmailConfirmationInput {
  const query = new URLSearchParams(search),
    hash = new URLSearchParams(fragment.replace(/^#/, ""));
  for (const params of [query, hash]) {
    if (["error", "error_code", "error_description"].some((key) => params.has(key)))
      return { kind: "invalid" };
    if (
      ["token_hash", "code", "access_token", "refresh_token", "type"].some(
        (key) => params.getAll(key).length > 1,
      )
    )
      return { kind: "invalid" };
    const type = params.get("type");
    if (type && !["signup", "email"].includes(type)) return { kind: "invalid" };
  }
  const tokenHash = query.get("token_hash"),
    code = query.get("code"),
    access = hash.get("access_token"),
    refresh = hash.get("refresh_token");
  const valid = (value: string | null): value is string => !!value?.trim() && value.length <= 16384;
  if (
    hash.has("token_hash") ||
    hash.has("code") ||
    query.has("access_token") ||
    query.has("refresh_token")
  )
    return { kind: "invalid" };
  if (
    Number(query.has("token_hash")) +
      Number(query.has("code")) +
      Number(hash.has("access_token") || hash.has("refresh_token")) !==
    1
  )
    return { kind: "invalid" };
  if (valid(tokenHash)) return { kind: "hash", value: tokenHash };
  if (valid(code)) return { kind: "code", value: code };
  if (valid(access) && valid(refresh))
    return { kind: "tokens", access_token: access, refresh_token: refresh };
  return { kind: "invalid" };
}
export function createEmailConfirmationFlow(deps: {
  main: Pick<Auth, "getSession" | "setSession" | "onAuthStateChange">;
  confirmation: Pick<
    Auth,
    "verifyOtp" | "exchangeCodeForSession" | "setSession" | "getUser" | "stopAutoRefresh"
  >;
  available: () => boolean;
  active: () => boolean;
  invalidate: () => void;
  cleanup: () => void;
  prepareCode: () => () => void;
  saveBoundSession?: (
    tokens: { access_token: string; refresh_token: string },
    current: () => boolean,
    initialOwner: string | null,
    verifiedOwner: string,
  ) => ReturnType<Auth["setSession"]>;
}) {
  let invalid = false,
    started = false,
    verifiedId: string | undefined,
    savingId: string | undefined;
  let subscription: { unsubscribe(): void } | undefined, clearVerifier: (() => void) | undefined;
  const failure = () => new Error("Email confirmation could not be verified. Please start again.");
  const current = () => !invalid && deps.active() && deps.available();
  async function owner() {
    const result = await deps.main.getSession();
    if (result.error) throw failure();
    return result.data.session?.user.id ?? null;
  }
  function cancel() {
    invalid = true;
    subscription?.unsubscribe();
    subscription = undefined;
    try {
      clearVerifier?.();
    } catch {
      /* Browser storage may itself be unavailable. */
    }
    try {
      deps.cleanup();
    } catch {
      /* Best effort now; final cleanup still checks failures. */
    }
  }
  async function cleanup() {
    let failed = false;
    try {
      clearVerifier?.();
    } catch {
      failed = true;
    }
    try {
      deps.cleanup();
    } catch {
      failed = true;
    }
    try {
      await deps.confirmation.stopAutoRefresh();
    } catch {
      failed = true;
    }
    if (failed) {
      cancel();
      throw failure();
    }
  }
  async function run(input: EmailConfirmationInput) {
    if (started) throw failure();
    started = true;
    try {
      if (input.kind === "invalid" || !current()) throw failure();
      const initialOwner = await owner();
      if (!current()) throw failure();
      subscription = deps.main.onAuthStateChange((event, session) => {
        const expected = savingId ?? verifiedId ?? initialOwner;
        if (event === "SIGNED_OUT" || (session?.user.id ?? null) !== expected) {
          cancel();
          deps.invalidate();
        }
      }).data.subscription;
      if (!current() || (await owner()) !== initialOwner) throw failure();
      deps.cleanup();
      let result;
      if (input.kind === "hash")
        result = await deps.confirmation.verifyOtp({ token_hash: input.value, type: "signup" });
      else if (input.kind === "code") {
        clearVerifier = deps.prepareCode();
        result = await deps.confirmation.exchangeCodeForSession(input.value);
      } else
        result = await deps.confirmation.setSession({
          access_token: input.access_token,
          refresh_token: input.refresh_token,
        });
      const session = result.data.session;
      if (
        result.error ||
        !session?.user.id?.trim() ||
        !session.access_token?.trim() ||
        !session.refresh_token?.trim() ||
        !current()
      )
        throw failure();
      // A result must belong to this request and be confirmed by the server;
      // INITIAL_SESSION/SIGNED_IN alone never establishes link success.
      const verified = await deps.confirmation.getUser(session.access_token);
      if (
        verified.error ||
        verified.data.user?.id !== session.user.id ||
        !verified.data.user?.email_confirmed_at ||
        !current() ||
        (await owner()) !== initialOwner
      )
        throw failure();
      savingId = session.user.id;
      const tokens = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };
      const saved = deps.saveBoundSession
        ? await deps.saveBoundSession(tokens, current, initialOwner, savingId)
        : await deps.main.setSession(tokens);
      if (
        saved.error ||
        saved.data.session?.user.id !== savingId ||
        !current() ||
        (await owner()) !== savingId
      )
        throw failure();
      verifiedId = savingId;
      return verifiedId;
    } catch {
      cancel();
      throw failure();
    } finally {
      await cleanup();
    }
  }
  async function matches() {
    try {
      return !!verifiedId && current() && (await owner()) === verifiedId && current();
    } catch {
      return false;
    }
  }
  return { run, matches, cancel };
}
