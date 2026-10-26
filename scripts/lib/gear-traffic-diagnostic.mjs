// Fixed categories only: no host names, paths, query strings, headers or bodies.
export function gearTrafficDiagnostic(rawUrl, method, resourceType, reason) {
  let origin = "invalid",
    family = "other";
  try {
    const url = new URL(rawUrl);
    origin =
      url.origin === "https://supdiver-recovery-test.vercel.app"
        ? "recovery_site"
        : url.origin === "https://esovqvampbrhuhamkfcs.supabase.co"
          ? "recovery_backend"
          : ["supdiver.com", "www.supdiver.com", "zmhtlhpeulhhcvlnjdrb.supabase.co"].includes(
                url.hostname,
              )
            ? "production"
            : "foreign";
    const paths = new Map([
      ["/rest/v1/gear_items", "gear"],
      ["/rest/v1/profiles", "profile"],
      ["/auth/v1/token", "auth_token"],
      ["/auth/v1/user", "auth_user"],
      ["/auth/v1/settings", "auth_settings"],
      ["/auth/v1/logout", "auth_logout"],
    ]);
    family =
      paths.get(url.pathname) ||
      (url.pathname.startsWith("/rest/v1/rpc/")
        ? "other_rpc"
        : url.pathname.startsWith("/rest/v1/")
          ? "other_rest"
          : url.pathname.startsWith("/storage/v1/")
            ? "storage"
            : url.pathname.startsWith("/auth/v1/")
              ? "other_auth"
              : url.pathname.startsWith("/assets/")
                ? "asset"
                : "other");
  } catch {
    /* No arbitrary parsing-error text. */
  }
  return {
    origin,
    family,
    method: ["GET", "HEAD", "OPTIONS", "POST", "PATCH", "DELETE", "PUT"].includes(method)
      ? method
      : "OTHER",
    resource: ["document", "script", "stylesheet", "image", "font", "fetch", "xhr"].includes(
      resourceType,
    )
      ? resourceType
      : "other",
    reason: [
      "foreign_origin",
      "read_path_not_allowed",
      "fixture_login_only",
      "fixture_mutations_only",
      "conditional_fixture_mutation_only",
      "lost_patch_only",
      "lost_reply_committed",
    ].includes(reason)
      ? reason
      : "route_handler_error",
  };
}
