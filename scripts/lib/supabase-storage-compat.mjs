// Narrow compatibility guard for auth-js's optional module-initialization debug
// read. Do not replace browser storage, auth storage or lock implementations.
export function supabaseStorageCompat() {
  return {
    name: "supdiver-supabase-storage-debug-guard",
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0].replaceAll("\\", "/");
      if (!/\/@supabase\/auth-js\/dist\/module\/lib\/locks\.js$/.test(path)) return null;
      const expression =
        /debug:\s*!!\(globalThis\s*&&\s*supportsLocalStorage\(\)\s*&&\s*globalThis\.localStorage\s*&&\s*globalThis\.localStorage\.getItem\('supabase\.gotrue-js\.locks\.debug'\) === 'true'\)/g;
      const matches = [...code.matchAll(expression)];
      if (matches.length !== 1) {
        throw new Error(
          "auth-js debug storage compatibility target changed; review before building",
        );
      }
      return {
        code: code.replace(
          expression,
          `debug: (() => { try { return ${matches[0][0].replace(/^debug:\s*/, "")}; } catch { return false; } })()`,
        ),
        map: null,
      };
    },
  };
}
