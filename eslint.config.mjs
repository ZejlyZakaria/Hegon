import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase Edge Functions are DENO, not Next. They import over https://, they use `Deno.serve`,
    // and this config cannot type any of it — so it reported them as broken, permanently, no matter
    // what they contained. `npm run lint` therefore exited 1 on a clean tree, which trains everyone
    // to ignore the colour red. Deno lints them; ESLint should not pretend to.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
