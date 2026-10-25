import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecoveryBinding } from "@/lib/bound-password-reset";
type Auth = SupabaseClient["auth"];
export type RecoveryInput =
  | { kind: "invalid" }
  | { kind: "hash"; value: string }
  | { kind: "code"; value: string }
  | { kind: "tokens"; access_token: string; refresh_token: string };

export function recoveryInput(search: string, fragment: string): RecoveryInput {
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
    if (params.has("type") && params.get("type") !== "recovery") return { kind: "invalid" };
  }
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
  const valid = (value: string | null): value is string => !!value?.trim() && value.length <= 16384;
  for (const kind of ["hash", "code"] as const) {
    const value = query.get(kind === "hash" ? "token_hash" : "code");
    if (valid(value)) return { kind, value };
  }
  const access = hash.get("access_token"),
    refresh = hash.get("refresh_token");
  if (hash.get("type") === "recovery" && valid(access) && valid(refresh))
    return { kind: "tokens", access_token: access, refresh_token: refresh };
  return { kind: "invalid" };
}

export function createRecoveryFlow(deps: {
  main: Pick<Auth, "getSession" | "onAuthStateChange">;
  recovery: Pick<
    Auth,
    "verifyOtp" | "exchangeCodeForSession" | "setSession" | "getUser" | "stopAutoRefresh"
  >;
  active: () => boolean;
  available: () => boolean;
  expectedLogout: () => boolean;
  invalidate: () => void;
  cleanup: () => void;
  prepareCode: () => () => void;
  save: (
    tokens: { access_token: string; refresh_token: string },
    current: () => boolean,
    initialOwner: string | null,
    verifiedOwner: string,
  ) => ReturnType<Auth["setSession"]>;
}) {
  let cancelled = false,
    started = false,
    savingId: string | undefined,
    verifiedId: string | undefined;
  let subscription: { unsubscribe(): void } | undefined, clearVerifier: (() => void) | undefined;
  const failure = () => new Error("Password recovery could not be verified. Request a new link.");
  const current = () => !cancelled && deps.active() && deps.available();
  const owner = async () => {
    const result = await deps.main.getSession();
    if (result.error) throw failure();
    return result.data.session?.user.id ?? null;
  };
  const cancel = () => {
    cancelled = true;
    subscription?.unsubscribe();
    subscription = undefined;
    try {
      clearVerifier?.();
    } catch {
      /* Exact verifier cleanup only. */
    }
    try {
      deps.cleanup();
    } catch {
      /* Retry after the pending SDK call settles. */
    }
  };
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
      await deps.recovery.stopAutoRefresh();
    } catch {
      failed = true;
    }
    if (failed) {
      cancel();
      throw failure();
    }
  }
  async function run(input: RecoveryInput): Promise<RecoveryBinding> {
    if (started) throw failure();
    started = true;
    try {
      if (input.kind === "invalid" || !current()) throw failure();
      let initialOwner: string | null = null,
        initialized = false;
      const initializingOwners: (string | null)[] = [];
      subscription = deps.main.onAuthStateChange((event, session) => {
        if (!initialized) {
          if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
            initializingOwners.push(session?.user.id ?? null);
          else {
            cancel();
            deps.invalidate();
          }
          return;
        }
        if (verifiedId && deps.expectedLogout() && event === "SIGNED_OUT") return;
        const expected = savingId ?? verifiedId ?? initialOwner;
        // A change away from the baseline invalidates even if the user later returns.
        // No asynchronous SDK calls from auth callbacks.
        if (event === "SIGNED_OUT" || (session?.user.id ?? null) !== expected) {
          cancel();
          deps.invalidate();
        }
      }).data.subscription;
      initialOwner = await owner();
      initialized = true;
      if (initializingOwners.some((id) => id !== initialOwner)) throw failure();
      if (!current() || (await owner()) !== initialOwner) throw failure();
      deps.cleanup();
      let result;
      if (input.kind === "hash")
        result = await deps.recovery.verifyOtp({ token_hash: input.value, type: "recovery" });
      else if (input.kind === "code") {
        clearVerifier = deps.prepareCode();
        result = await deps.recovery.exchangeCodeForSession(input.value);
      } else result = await deps.recovery.setSession(input);
      const session = result.data.session;
      if (
        result.error ||
        !session?.user.id?.trim() ||
        !session.access_token?.trim() ||
        !session.refresh_token?.trim() ||
        !current()
      )
        throw failure();
      const server = await deps.recovery.getUser(session.access_token);
      if (
        server.error ||
        server.data.user?.id !== session.user.id ||
        !current() ||
        (await owner()) !== initialOwner
      )
        throw failure();
      savingId = session.user.id;
      const saved = await deps.save(
        { access_token: session.access_token, refresh_token: session.refresh_token },
        current,
        initialOwner,
        savingId,
      );
      if (
        saved.error ||
        saved.data.session?.user.id !== savingId ||
        !saved.data.session.access_token ||
        !current() ||
        (await owner()) !== savingId
      )
        throw failure();
      verifiedId = savingId;
      return { userId: verifiedId, accessToken: saved.data.session.access_token };
    } catch {
      cancel();
      throw failure();
    } finally {
      await cleanup();
    }
  }
  return { run, cancel };
}
