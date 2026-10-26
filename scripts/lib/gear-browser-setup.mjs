// This function is serialized into the isolated fixture page. An initial
// about:blank document has an opaque origin and cannot access localStorage.
export function initializeGearLanguage(language) {
  if (location.origin !== "https://supdiver-recovery-test.vercel.app") return;
  localStorage.setItem("deepocean-language", language);
}

// Exact public stylesheet referenced by __root.tsx; never permit forwarding.
export function isGearFontStylesheet(rawUrl, method, resourceType) {
  try {
    const url = new URL(rawUrl);
    return (
      method === "GET" &&
      resourceType === "stylesheet" &&
      url.origin === "https://fonts.googleapis.com" &&
      url.pathname === "/css2" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.searchParams.size === 2 &&
      url.searchParams.get("family") === "Noto Sans SC:wght@300;400;500" &&
      url.searchParams.get("display") === "swap"
    );
  } catch {
    return false;
  }
}
