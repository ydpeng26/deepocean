// Fixed recovery origin, public assets only. Injectable transport for local tests.
const site = "https://supdiver-recovery-test.vercel.app";
function requireCheck(ok, code) {
  if (!ok) {
    const error = Error(code);
    error.auditCode = code;
    throw error;
  }
}
export async function gearRecoveryPreflight(transport = fetch, signal) {
  const options = () => ({
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    cache: "no-store",
    redirect: "error",
  });
  const response = await transport(site + "/offline-assets.json", options());
  // Native fetch Response.ok is a boolean (Playwright APIResponse.ok is a method).
  requireCheck(response.ok, "public_manifest");
  const manifest = await response.json();
  requireCheck(Array.isArray(manifest), "public_asset_array");
  const paths = manifest.filter(
    (path) => typeof path === "string" && /^\/assets\/[^/?#]+\.js$/.test(path),
  );
  requireCheck(paths.length > 0, "public_scripts_missing");
  const scripts = await Promise.all(
    paths.map(async (path) => {
      const result = await transport(site + path, options());
      requireCheck(result.ok, "public_script");
      return result.text();
    }),
  );
  requireCheck(
    scripts.some((text) => text.includes("Load latest gear record")) &&
      scripts.some((text) => text.includes("GearConflictError")),
    "fixed_site_missing_gear_concurrency_repair",
  );
  requireCheck(
    scripts.some((text) => text.includes("esovqvampbrhuhamkfcs.supabase.co")),
    "fixed_site_recovery_backend",
  );
  return { scriptCount: scripts.length };
}
