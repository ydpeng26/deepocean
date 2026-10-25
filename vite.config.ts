// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { supabaseStorageCompat } from "./scripts/lib/supabase-storage-compat.mjs";

export default defineConfig({
  vite: {
    plugins: [supabaseStorageCompat()],
    // Keep the narrow compatibility guard active in development too, rather
    // than consuming an unguarded prebundled SDK. Production uses the same plugin.
    optimizeDeps: { exclude: ["@supabase/supabase-js", "@supabase/auth-js"] },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
