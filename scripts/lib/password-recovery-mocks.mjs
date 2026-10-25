// Synthetic responses only. This module never forwards a request.
export function passwordRecoveryMock(request, fixture, mode, counts) {
  const url = new URL(request.url);
  const check = (ok) => {
    if (!ok) {
      const e = Error("synthetic_request_only");
      e.auditCode = "synthetic_request_only";
      throw e;
    }
  };
  if (url.origin !== fixture.api) return null;
  if (
    request.method === "OPTIONS" &&
    ["/auth/v1/user", "/auth/v1/verify", "/auth/v1/token", "/auth/v1/logout"].includes(url.pathname)
  )
    return { kind: "preflight", status: 204 };
  if (request.method === "POST" && url.pathname === "/auth/v1/verify") {
    check(request.body?.token_hash === fixture.hash && request.body?.type === "recovery");
    counts.verifies++;
    return {
      kind: "verify",
      abort: mode === "network-error",
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
    );
    counts.exchanges++;
    return {
      kind: "exchange",
      status: mode === "exchange-error" ? 400 : 200,
      body:
        mode === "exchange-error"
          ? { code: "bad_code_verifier", msg: "Synthetic bad code" }
          : fixture.newSession,
    };
  }
  const entry = fixture.sessions.find((s) => request.bearer === "Bearer " + s.access_token);
  if (request.method === "GET" && url.pathname === "/auth/v1/user") {
    check(entry);
    const isNew = entry.user.id === fixture.newSession.user.id;
    counts.userReads++;
    if (isNew) counts.newUserReads++;
    return {
      kind: "user",
      isNew,
      status: 200,
      body: isNew && mode === "user-mismatch" ? fixture.otherSession.user : entry.user,
    };
  }
  if (request.method === "PUT" && url.pathname === "/auth/v1/user") {
    check(
      entry?.user.id === fixture.newSession.user.id &&
        request.body?.password === fixture.password &&
        Object.keys(request.body).length === 1,
    );
    counts.passwords++;
    return {
      kind: "password",
      status: mode === "update-error" ? 422 : 200,
      body: mode === "update-error" ? { msg: "Synthetic rejected update" } : entry.user,
    };
  }
  if (
    request.method === "POST" &&
    url.pathname === "/auth/v1/logout" &&
    url.searchParams.get("scope") === "local"
  ) {
    check(entry?.user.id === fixture.newSession.user.id);
    counts.logouts++;
    return { kind: "logout", status: 204 };
  }
  return null;
}
