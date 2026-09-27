import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@playloop/ui": fileURLToPath(
        new URL("../../packages/ui/src", import.meta.url)
      ),
      "@playloop/game-engine": fileURLToPath(
        new URL("../../packages/game-engine/src", import.meta.url)
      ),
      "@": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
  },
})
