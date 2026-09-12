import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ─────────────────────────────────────────────────────────────────────────────
// Les sélecteurs de `no-restricted-syntax`, partagés entre blocs.
//
// ⚠️ En flat config, `rules` ne FUSIONNE pas : pour un même nom de règle, le dernier bloc qui
// matche un fichier REMPLACE la configuration entière. Un bloc `src/**` posé après le garde des
// coordonnées Watching l'effaçait en silence — vérifié le 2026-09-12 avec `--print-config`, au
// moment d'ajouter la doctrine de cache. Donc chaque bloc liste TOUS les sélecteurs qui le
// concernent, et l'ordre des blocs est du plus large au plus précis.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LA DOCTRINE DE CACHE — règle R4 de hq/rules/system-design.md, rendue mécanique (2026-09-12).
 *
 * Mesuré avant : 129 `useQuery`, 126 `staleTime` déclarés dans 78 fichiers, 51 recopiant le défaut
 * de 5 min, la même minute écrite de trois façons. Le réglage global ne gouvernait que 10 requêtes sur 129.
 * Il n'y avait pas de doctrine, il y avait 78 fichiers qui décidaient chacun pour eux.
 *
 * Un `staleTime` est désormais un PALIER de `src/shared/lib/stale.ts` (`STALE.MINUTE`,
 * `STALE.DAY`…), jamais un nombre. Le défaut n'est jamais redéclaré : on hérite. Sans cette règle
 * on repart à 126 valeurs dans six mois — un mécanisme, pas un état.
 */
const STALE_TIME_IS_A_TIER = {
  selector:
    "Property[key.name='staleTime']:not([value.type='MemberExpression'][value.object.name='STALE'])",
  message:
    "staleTime prend un palier de `STALE` (src/shared/lib/stale.ts), jamais un nombre. Doctrine de cache, règle R4.",
};

/**
 * LE DÉFAUT S'HÉRITE — il ne se redéclare pas. `STALE.DEFAULT` n'a qu'un seul site légitime :
 * `defaultOptions` de QueryProvider, qui porte l'`eslint-disable` correspondant. Partout ailleurs
 * c'est le retour du bruit qu'on vient de retirer (51 sites). Contre-examen du 2026-09-13 : sans
 * ce sélecteur, « refusé par ESLint » était une phrase, pas une règle.
 */
const STALE_DEFAULT_IS_INHERITED = {
  selector:
    "Property[key.name='staleTime'] > MemberExpression[object.name='STALE'][property.name='DEFAULT']",
  message:
    "STALE.DEFAULT ne se déclare pas dans un hook : retire la ligne, le défaut de QueryProvider s'applique. Doctrine de cache, règle R4.",
};

/**
 * LE N+1 DE SERVICE — règle R3 (chemin d'une requête / cascades) de hq/rules/system-design.md.
 *
 * Mesuré sur /perso/watching/movies : 15 requêtes Supabase en 4 vagues séquentielles là où une
 * vague suffirait. La vague 4 = `getActiveWatchingGoals` qui, après avoir lu les objectifs, lance
 * `Promise.all(goals.map(async g => await count(...)))` — UNE requête PAR objectif. Huit sites de
 * cette forme dans les services (5 dans Goals, 2 par course en F1, un appel iTunes PAR MORCEAU dans
 * Watching). Chacun coûte un aller-retour par ligne, ~250 ms d'ici jusqu'en Irlande.
 *
 * La règle : un service n'émet jamais une requête par élément d'une liste. Une liste se résout en
 * UNE requête (`.in(...)`, jointure, RPC, GROUP BY). Les 8 sites existants portent un
 * `eslint-disable` qui dit pourquoi et renvoie à l'audit de leur module (phase 3, axe 3) — la
 * dette est annotée, plus aucune nouvelle n'entre. C'est une DÉTECTION, pas une correction.
 *
 * TROIS FORMES sont attrapées (contre-examen du 2026-09-13 — la première seule laissait passer
 * les deux autres, dont `reorderStatuses` dans tasks/service.ts, un N+1 réel) :
 *   1. `.map(async (x) => { await … })` — callback async avec un await, corps expression ou bloc ;
 *   2. `for (const x of xs) { await … }` — la boucle séquentielle, même dette, autre syntaxe ;
 *   3. `Promise.all(xs.map((x) => supabase.from(…)…))` — callback NON async qui construit une
 *      requête : la forme idiomatique, la plus courante.
 * Le sélecteur cible le CALLBACK (ou la boucle), pas chaque `await` : un site = un signalement.
 *
 * Ce qui passe encore, assumé FRAGILE : `Array.from(xs, …)`, une chaîne `.then(…)`, et un helper
 * qui encapsule la requête (`xs.map((x) => getOne(x))` — rien dans le callback ne dit « requête »).
 *
 * Leçon esquery, corrigée le 13/09 : dans `:has()`, `>` veut dire ENFANT DIRECT, sémantique
 * normale — un arrow à corps `{ }` a un `BlockStatement` pour enfant, pas l'`await`. Écrire
 * `Parent > Callback:has(AwaitExpression)`, jamais `:has(> … AwaitExpression)`.
 */
const NO_N_PLUS_ONE_IN_SERVICES = {
  selector:
    ":matches(" +
    "CallExpression[callee.property.name=/^(map|forEach|flatMap)$/] > :matches(ArrowFunctionExpression, FunctionExpression)[async=true]:has(AwaitExpression), " +
    ":matches(ForOfStatement, ForStatement, WhileStatement):has(AwaitExpression), " +
    "CallExpression[callee.property.name=/^(map|flatMap)$/] > ArrowFunctionExpression[async!=true]:has(CallExpression[callee.property.name='from'])" +
    ")",
  message:
    "N+1 : une requête par élément (map async avec await, boucle avec await, ou map construisant une requête). Résous la liste en UNE requête (`.in()`, jointure, RPC). Si c'est une dette connue, un eslint-disable avec la raison et l'audit qui la corrige. Doctrine, règle R3.",
};

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
 *
 * ERROR, not warn. It shipped as a warning "to be promoted once the legitimate reads are
 * annotated" — which was never a real intermediate state: the pre-commit hook runs eslint with
 * --max-warnings 0, so the warning blocked commits anyway while pretending to be advisory.
 * A rule this repo treats as fatal should say so.
 *
 * Every legitimate read now carries a one-line reason, and they fall into four kinds: local
 * stepper state that mirrors the row (gathered into ONE accessor per file rather than
 * scattered), explicit `view ? lens : raw` fallbacks for titles with no overlay, space-
 * invariant tests and totals, and Episodes' no-overlay branch. Anything else is a bug.
 */
const NO_RAW_COORDINATE_READ = {
  selector:
    "MemberExpression[property.name=/^(current_season|current_episode|season_episodes|season_aired|season_years|season_ratings|cour_years|cour_ratings)$/]",
  message:
    "Coordinate/space-dependent column read in a component. Use the MediaView (view.position, view.seasons, view.yearMap, view.ratingMap, view.writeYear…) — a lumped anime stores flat coordinates and displays cour ones, and reading the raw column silently shows the wrong space. If this really must read storage, add an eslint-disable line SAYING WHY.",
};

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

  // ── Le plus large : toute l'app ──────────────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", STALE_TIME_IS_A_TIER, STALE_DEFAULT_IS_INHERITED],
    },
  },

  // ── Les composants Watching : le garde des coordonnées, PLUS la doctrine de cache ──
  // `components/stats/**` is COMPUTATION, not a display surface: it counts totals (identical in
  // either space) and indexes by TMDB season on purpose, because that is what the Stats page has
  // always meant. Putting it through the lens would change its numbers, not fix them.
  {
    files: ["src/modules/watching/components/**/*.{ts,tsx}", "src/app/(main)/perso/watching/**/*.tsx"],
    ignores: ["src/modules/watching/components/stats/**"],
    rules: {
      "no-restricted-syntax": ["error", NO_RAW_COORDINATE_READ, STALE_TIME_IS_A_TIER, STALE_DEFAULT_IS_INHERITED],
    },
  },

  // ── Les services et les routes API : le N+1, PLUS la doctrine de cache ──────
  {
    files: ["src/modules/**/service.ts", "src/app/api/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", NO_N_PLUS_ONE_IN_SERVICES, STALE_TIME_IS_A_TIER, STALE_DEFAULT_IS_INHERITED],
    },
  },
]);

export default eslintConfig;
