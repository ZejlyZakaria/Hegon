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
    // Claude skill tooling — VENDORED third-party scripts, not this app's code. They were producing
    // 128 of the 155 warnings on a clean tree (a single minified UMD bundle accounts for 78), which
    // is the same disease as the Deno case above: a wall of red nobody can act on teaches everyone
    // to stop reading it. The 26 warnings that remain are ours, deliberate, and one rule.
    ".claude/**",
  ]),

  /**
   * THE COORDINATE GUARD — the invariant that stopped depending on anyone remembering it.
   *
   * A lumped anime stores a FLAT position ("episode 59") and displays a cour one ("S3 E12"), and the
   * same split exists for the year/rating maps (`season_years` vs `cour_years`). `lib/media-view.ts`
   * is the one sanctioned translator. But the overlay was applied BY HAND, surface by surface, so
   * every new surface forgot it by default — cards printed flat episodes, and QuickStats read
   * `season_years` (empty for an overlaid anime) and silently showed no "Started" at all.
   *
   * That last one survived a full manual audit: I read `computeStats` and never opened `QuickStats`.
   * A convention that depends on me checking every file is not a rule — so it is a lint error now.
   * Components consume a `MediaView`; only the pure libs and the storage-space maths read raw.
   */
  {
    // `components/stats/**` is COMPUTATION, not a display surface: it counts totals (identical in
    // either space) and indexes by TMDB season on purpose, because that is what the Stats page has
    // always meant. Putting it through the lens would change its numbers, not fix them.
    files: ["src/modules/watching/components/**/*.{ts,tsx}", "src/app/(main)/perso/watching/**/*.tsx"],
    ignores: ["src/modules/watching/components/stats/**"],
    rules: {
      // ERROR, not warn. It shipped as a warning "to be promoted once the legitimate reads are
      // annotated" — which was never a real intermediate state: the pre-commit hook runs eslint with
      // --max-warnings 0, so the warning blocked commits anyway while pretending to be advisory.
      // A rule this repo treats as fatal should say so.
      //
      // Every legitimate read now carries a one-line reason, and they fall into four kinds: local
      // stepper state that mirrors the row (gathered into ONE accessor per file rather than
      // scattered), explicit `view ? lens : raw` fallbacks for titles with no overlay, space-
      // invariant tests and totals, and Episodes' no-overlay branch. Anything else is a bug.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^(current_season|current_episode|season_episodes|season_aired|season_years|season_ratings|cour_years|cour_ratings)$/]",
          message:
            "Coordinate/space-dependent column read in a component. Use the MediaView (view.position, view.seasons, view.yearMap, view.ratingMap, view.writeYear…) — a lumped anime stores flat coordinates and displays cour ones, and reading the raw column silently shows the wrong space. If this really must read storage, add an eslint-disable line SAYING WHY.",
        },
      ],
    },
  },
]);

export default eslintConfig;
