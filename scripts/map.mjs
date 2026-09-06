// La carte de HEGON — GÉNÉRÉE DEPUIS LE CODE, jamais écrite à la main.
//
// hq/audit/map.md §2 est un tableau de chiffres. Un tableau de chiffres écrit à la main est
// périmé dans la quinzaine — c'est exactement le mal que le chantier d'audit combat
// (cf. hq/audit/plan.md §1 : « le code va plus vite que sa description »). Ce script les
// recalcule, pour qu'un écart entre la carte et le repo se voie en une commande.
//
//   node scripts/map.mjs            → tableau lisible, à recopier dans map.md §2
//   node scripts/map.mjs --json     → même chose en JSON
//
// Il ne réécrit PAS map.md : la §1 (le dessin) et la §3 (les écarts) sont du jugement humain.

import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Tous les fichiers sous `dir` dont le nom passe `keep`. */
function walk(dir, keep = () => true, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

const isCode = (p) => /\.tsx?$/.test(p);
const read = (p) => readFileSync(p, "utf8");
// `wc -l` compte les sauts de ligne, pas les segments — sinon chaque fichier gagne une ligne fantôme.
const lines = (p) => {
  const s = read(p);
  return s.split("\n").length - (s.endsWith("\n") ? 1 : 0);
};
const rel = (p) => relative(ROOT, p).split(sep).join("/");

// ── Code applicatif ────────────────────────────────────────────────────────────
const srcFiles = walk(SRC, isCode);
const srcLines = srcFiles.reduce((n, f) => n + lines(f), 0);
const tsxFiles = srcFiles.filter((f) => f.endsWith(".tsx"));
const clientFiles = srcFiles.filter((f) => /^\s*["']use client["']/m.test(read(f)));

// ── Modules ────────────────────────────────────────────────────────────────────
const MODULES_DIR = join(SRC, "modules");
const modules = readdirSync(MODULES_DIR)
  .map((m) => {
    const files = walk(join(MODULES_DIR, m), isCode);
    return { name: m, files: files.length, lines: files.reduce((n, f) => n + lines(f), 0) };
  })
  .sort((a, b) => b.lines - a.lines);

// ── Routes ─────────────────────────────────────────────────────────────────────
const appFiles = walk(join(SRC, "app"), isCode);
const pages = appFiles.filter((f) => /[\\/]page\.tsx$/.test(f));
const apiRoutes = appFiles.filter((f) => /[\\/]api[\\/].*route\.ts$/.test(f));
// Une page est « serveur » tant qu'elle ne se déclare pas cliente.
const serverPages = pages.filter((f) => !/^\s*["']use client["']/m.test(read(f)));

// ── Base de données ────────────────────────────────────────────────────────────
const fnDirs = existsSync(join(ROOT, "supabase", "functions"))
  ? readdirSync(join(ROOT, "supabase", "functions")).filter((d) =>
      statSync(join(ROOT, "supabase", "functions", d)).isDirectory(),
    )
  : [];
const migrations = existsSync(join(ROOT, "supabase", "migrations"))
  ? readdirSync(join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql"))
  : [];
const migrationSql = migrations.map((f) => read(join(ROOT, "supabase", "migrations", f))).join("\n");

const edgeSources = walk(join(ROOT, "supabase", "functions"), (p) => p.endsWith(".ts"));
const tableRefs = new Set();
for (const f of [...srcFiles, ...edgeSources]) {
  for (const m of read(f).matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]/g)) tableRefs.add(m[1]);
}
// `.from()` sert aussi au storage — ces deux-là sont des buckets, pas des tables.
const BUCKETS = new Set(["posters", "avatars"]);
const tables = [...tableRefs].filter((t) => !BUCKETS.has(t)).sort();

const created = new Set(
  [...migrationSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_."]+)"?/gi)].map(
    (m) => m[1].replace(/"/g, "").split(".").pop(),
  ),
);
const neverMigrated = tables.filter((t) => !created.has(t));

// Un cron versionné = un `cron.schedule` non commenté.
const scheduledInRepo = migrationSql
  .split("\n")
  .filter((l) => l.includes("cron.schedule") && !l.trim().startsWith("--")).length;

// Une edge function est « déclenchée depuis le repo » si son nom apparaît ailleurs que chez elle.
const callerHaystack = [...srcFiles.map(read), migrationSql].join("\n");
const edgeWithoutCaller = fnDirs.filter((f) => !callerHaystack.includes(f));

// ── Tests & garde-fous ─────────────────────────────────────────────────────────
const tests = srcFiles.filter((f) => /\.test\.tsx?$/.test(f));
const testsByModule = {};
for (const t of tests) {
  const m = rel(t).match(/^src\/modules\/([^/]+)\//);
  const key = m ? m[1] : rel(t).split("/")[1];
  testsByModule[key] = (testsByModule[key] ?? 0) + 1;
}
const ci = existsSync(join(ROOT, ".github/workflows/ci.yml"))
  ? read(join(ROOT, ".github/workflows/ci.yml"))
  : "";
const ciRunsTests = /npm run test|vitest/.test(ci);
const ciRunsKnip = /knip/.test(ci);
const ciRunsDsCoverage = /ds:coverage/.test(ci);

// ── Design system ──────────────────────────────────────────────────────────────
const covPath = join(MODULES_DIR, "styleguide", "coverage.generated.json");
const cov = existsSync(covPath) ? JSON.parse(read(covPath)) : null;
const dsHits = cov
  ? Object.values(cov.modules).reduce(
      (n, m) => n + Object.values(m.smells).reduce((a, b) => a + b, 0),
      0,
    )
  : null;

// ── Docs ───────────────────────────────────────────────────────────────────────
const hqDocs = walk(join(ROOT, "hq"), (p) => p.endsWith(".md"));
const hqLines = hqDocs.reduce((n, f) => n + lines(f), 0);

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  code: { lines: srcLines, files: srcFiles.length },
  modules,
  routes: { pages: pages.length, serverPages: serverPages.length, apiRoutes: apiRoutes.length },
  rendering: { clientFiles: clientFiles.length, tsxFiles: tsxFiles.length },
  db: {
    tablesReferenced: tables.length,
    tablesWithoutMigration: neverMigrated,
    migrations: migrations.length,
    edgeFunctions: fnDirs.length,
    edgeFunctionsWithoutCallerInRepo: edgeWithoutCaller,
    cronsVersioned: scheduledInRepo,
  },
  tests: { files: tests.length, byModule: testsByModule },
  gates: { ciRunsTests, ciRunsKnip, ciRunsDsCoverage },
  designSystem: cov ? { primitives: cov.primitives.length, offSystemHits: dsHits } : null,
  docs: { hqFiles: hqDocs.length, hqLines },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const row = (k, v) => console.log(`  ${k.padEnd(34)} ${v}`);
console.log(`\nHEGON — la carte, chiffres du ${report.generatedAt}\n`);
row("code applicatif", `${srcLines.toLocaleString("fr-FR")} lignes · ${srcFiles.length} fichiers`);
row("modules", modules.length);
row("routes", `${pages.length} pages (dont ${serverPages.length} serveur) · ${apiRoutes.length} API`);
row("rendu client", `${clientFiles.length} fichiers "use client" / ${tsxFiles.length} .tsx`);
row("tables référencées", tables.length);
row("  sans migration qui les crée", neverMigrated.length);
row("migrations", migrations.length);
row("edge functions", fnDirs.length);
row("  sans appelant dans le repo", edgeWithoutCaller.length);
row("crons versionnés", scheduledInRepo);
row("tests", `${tests.length} fichiers`);
row("  CI lance les tests", ciRunsTests ? "oui" : "NON");
row("  CI lance knip", ciRunsKnip ? "oui" : "NON");
row("  CI lance ds:coverage", ciRunsDsCoverage ? "oui" : "NON");
if (cov) row("design system", `${cov.primitives.length} primitifs · ${dsHits} hits hors-système`);
row("docs hq/", `${hqDocs.length} fichiers · ${hqLines.toLocaleString("fr-FR")} lignes`);

console.log("\n  modules par taille :");
for (const m of modules.slice(0, 8)) {
  console.log(`    ${m.name.padEnd(16)} ${String(m.lines).padStart(6)} l. · ${m.files} fichiers`);
}
console.log("");
