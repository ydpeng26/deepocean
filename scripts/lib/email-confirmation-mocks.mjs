// Pure synthetic auth responses. Never forwards requests or creates identities.
export function emailConfirmationMock(request, fixture, mode, counts) {
  const url = new URL(request.url);
  const check = (value, code) => {
    if (!value) {
      const error = Error(code);
      error.auditCode = code;
      throw error;
    }
  };
  if (url.origin !== fixture.api) return null;
  if (
    request.method === "OPTIONS" &&
    ["/auth/v1/user", "/auth/v1/verify", "/auth/v1/token"].includes(url.pathname)
  )
    return { kind: "preflight", status: 204 };
  if (request.method === "POST" && url.pathname === "/auth/v1/verify") {
    check(
      request.body?.token_hash === fixture.hash && request.body?.type === "signup",
      "synthetic_signup_hash_only",
    );
    counts.verifies++;
    if (mode === "network-error") return { kind: "verify", abort: true };
    return {
      kind: "verify",
      status: mode === "invalid-old" ? 400 : 200,
      body:
        mode === "invalid-old"
          ? { code: "otp_expired", msg: "Synthetic expired link" }
          : fixture.newSession,
    };
  }
  if (
    request.method === "POST" &&
    url.pathname === "/auth/v1/token" &&
    url.searchParams.get("grant_type") === "pkce"
  ) {
    check(
      request.body?.auth_code === fixture.code && request.body?.code_verifier === fixture.verifier,
      "synthetic_code_and_verifier_only",
    );
    counts.exchanges++;
    return {
      kind: "exchange",
      status: mode === "exchange-error" ? 400 : 200,
      body:
        mode === "exchange-error"
          ? { code: "bad_code_verifier", msg: "Synthetic invalid code" }
          : fixture.newSession,
    };
  }
  if (request.method === "GET" && url.pathname === "/auth/v1/user") {
    const entry = fixture.sessions.find(
      (session) => request.bearer === "Bearer " + session.access_token,
    );
    check(entry, "synthetic_bearer_only");
    const isNew = entry.user.id === fixture.newSession.user.id;
    counts.userReads++;
    if (isNew) counts.newUserReads++;
    return {
      kind: "user",
      isNew,
      status: 200,
      body:
        isNew && mode === "user-mismatch"
          ? fixture.otherSession.user
          : isNew && mode === "unconfirmed"
            ? { ...entry.user, email_confirmed_at: null }
            : entry.user,
    };
  }
  return null;
}
