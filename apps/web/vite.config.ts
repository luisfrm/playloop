import { reactRouter } from "@react-router/dev/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

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
  ],
})
