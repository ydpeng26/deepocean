// Only browser-normalized, same-origin root-relative destinations are accepted.
export function safeAuthReturn(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    Array.from(value).some(
      (char) => char === "\\" || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
  )
    return undefined;
  try {
    const base = "https://auth-return.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
