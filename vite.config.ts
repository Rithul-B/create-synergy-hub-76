// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { oauthLocalProxyPlugin } from "./vite-plugin-oauth-local-proxy";

// NOTE: do NOT define import.meta.env.VITE_SUPABASE_* here. The Lovable vite
// config injects them from the project's .env at build time; overriding them
// with process.env values (empty on the build machine) blanks the client
// credentials and breaks sign in / sign up in preview and production.
export default defineConfig({
  vite: {
    plugins: [oauthLocalProxyPlugin()],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
