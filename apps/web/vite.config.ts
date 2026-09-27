import { reactRouter } from "@react-router/dev/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// Set by the e2e run so tests get their own local D1 instead of the state a
// developer left in `.wrangler`. Unset in normal dev, which keeps the default.
const persistTo = process.env.PLAYLOOP_PERSIST_TO

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Runs the Worker in workerd during dev and emits the deployable bundle
    // during build, reading every binding from `wrangler.jsonc`. The `ssr`
    // environment is where React Router keeps the server build, so the Worker
    // entry must be built there.
    cloudflare({
      viteEnvironment: { name: "ssr" },
      persistState: persistTo ? { path: persistTo } : true,
    }),
    tailwindcss(),
    reactRouter(),
    // Offline play. The shell precache and the service worker itself are built
    // here from `app/service-worker.ts`; the manifest stays a public file, so
    // there is a single source of truth for it.
    VitePWA({
      strategies: "injectManifest",
      srcDir: "app",
      filename: "service-worker.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      // The deployable client build lives here, not in Vite's default `dist`.
      outDir: "build/client",
      injectManifest: {
        // The Cloudflare plugin writes the client build here.
        globDirectory: "build/client",
        globPatterns: ["**/*.{js,css,webmanifest,svg,ico,png}"],
      },
    }),
  ],
})
