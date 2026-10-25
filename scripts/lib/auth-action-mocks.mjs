// Pure synthetic responses. Never forwards requests to a backend or provider.
export function authActionMock(request, fixture, mode, counts) {
  const url = new URL(request.url);
  const check = (ok) => {
    if (!ok) {
      const error = Error("synthetic_auth_action_only");
      error.auditCode = "synthetic_auth_action_only";
      throw error;
    }
  };
  if (url.origin !== fixture.api) return null;
  const endpoints = [
    "/auth/v1/token",
    "/auth/v1/signup",
    "/auth/v1/resend",
    "/auth/v1/recover",
    "/auth/v1/user",
    "/auth/v1/logout",
  ];
  if (request.method === "OPTIONS" && endpoints.includes(url.pathname))
    return { kind: "preflight", status: 204 };
  if (request.method === "GET" && url.pathname === "/auth/v1/authorize") {
    check(
      url.searchParams.get("provider") === "google" &&
        url.searchParams.get("redirect_to") === fixture.site + "/oauth-callback" &&
        url.searchParams.get("code_challenge_method")?.toLowerCase() === "s256" &&
        /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code_challenge") ?? ""),
    );
    counts.google++;
    return {
      kind: "google",
      status: 302,
      location: fixture.site + "/oauth-callback?error=access_denied",
    };
  }
  if (request.method === "GET" && url.pathname === "/auth/v1/user") {
    check(request.bearer === "Bearer " + fixture.session.access_token);
    counts.user++;
    return { kind: "user", status: 200, body: fixture.session.user };
  }
  if (
    request.method === "POST" &&
    url.pathname === "/auth/v1/logout" &&
    url.searchParams.get("scope") === "local"
  ) {
    check(request.bearer === "Bearer " + fixture.session.access_token);
    counts.logout++;
    return { kind: "logout", status: 204 };
  }
  if (request.method !== "POST") return null;
  let kind;
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password")
    kind = "signin";
  else if (url.pathname === "/auth/v1/signup") kind = "signup";
  else if (url.pathname === "/auth/v1/resend") kind = "resend";
  else if (url.pathname === "/auth/v1/recover") kind = "reset";
  else return null;
  check(request.body?.email === fixture.email);
  if (["signin", "signup"].includes(kind)) check(request.body?.password === fixture.password);
  if (kind === "resend") check(request.body?.type === "signup");
  if (kind === "reset")
    check(url.searchParams.get("redirect_to") === fixture.site + "/reset-password");
  counts[kind]++;
  return {
    kind,
    status: mode === "error" ? 400 : 200,
    abort: mode === "network",
    body:
      mode === "error"
        ? { code: "synthetic_rejection", msg: "Synthetic rejected action" }
        : kind === "signin"
          ? fixture.session
          : kind === "signup"
            ? { user: fixture.session.user, session: null }
            : {},
  };
}
