import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/.wrangler/**",
      "**/.react-router/**",
      "**/.e2e/**",
      "**/test-results/**",
      "**/playwright-report/**",
      // Generados por `wrangler types` y por `react-router typegen`.
      "apps/web/workers/worker-configuration.d.ts",
      "apps/web/app/routes/+types/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // §14: complejidad ciclomática máxima por función.
      complexity: ["error", 15],
      // §14: iconos con lucide-react, nunca react-icons.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react-icons", "react-icons/*"],
              message: "Usa lucide-react para los iconos (§14).",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier
)
