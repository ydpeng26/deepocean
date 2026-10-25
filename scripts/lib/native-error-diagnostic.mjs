// Fixed error categories and known public bundle positions only. Never return
// message text, arbitrary stack frames, request URLs, codes, tokens or identities.
export function nativeErrorDiagnostic(error, publicAssets = new Set()) {
  const name = [
    "Error",
    "TypeError",
    "ReferenceError",
    "SyntaxError",
    "AbortError",
    "SecurityError",
    "QuotaExceededError",
  ].includes(error?.name)
    ? error.name
    : "OtherError";
  const message = typeof error?.message === "string" ? error.message : "";
  const category =
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)
      ? "module_load"
      : /lock.*(steal|abort)|signal.*abort|operation was aborted/i.test(message)
        ? "aborted_operation"
        : /storage|quota/i.test(message)
          ? "storage"
          : /Minified React error/i.test(message)
            ? "react"
            : /Cannot read propert|is not a function|is not defined/i.test(message)
              ? "javascript_reference_or_type"
              : /fetch|network/i.test(message)
                ? "network"
                : "unclassified";
  const stack = typeof error?.stack === "string" ? error.stack : "";
  const frames = [];
  for (const match of stack.matchAll(/\/assets\/([a-zA-Z0-9_-]+\.js):(\d{1,8}):(\d{1,8})/g)) {
    if (publicAssets.has("/assets/" + match[1]) && frames.length < 4)
      frames.push({ asset: match[1], line: Number(match[2]), column: Number(match[3]) });
  }
  return { name, category, frames };
}
