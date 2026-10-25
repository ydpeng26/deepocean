// Only fixed categories and runner source positions, never arbitrary error text.
export function gearBrowserDiagnostic(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const category = /strict mode violation/i.test(message)
    ? "ambiguous_locator"
    : /Timeout|timed out|exceeded/i.test(message)
      ? "timeout"
      : /Target.*closed|page.*closed|context.*closed/i.test(message)
        ? "closed_target"
        : /Response body|response.*json|JSON.*parse/i.test(message)
          ? "response_body"
          : /net::|network|fetch failed/i.test(message)
            ? "network"
            : /is not a function|Cannot read propert|is not defined/i.test(message)
              ? "javascript_type_or_reference"
              : "unclassified";
  const stack = typeof error?.stack === "string" ? error.stack : "";
  const positions = [...stack.matchAll(/recovery-gear-concurrency\.mjs:(\d{1,6}):(\d{1,6})/g)]
    .slice(0, 4)
    .map((match) => ({ line: Number(match[1]), column: Number(match[2]) }));
  const count = message.match(/resolved to (\d{1,5}) elements/);
  return { category, positions, ...(count ? { locatorMatches: Number(count[1]) } : {}) };
}
