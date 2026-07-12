// Design-system coverage — GENERATED FROM THE CODE, never hand-written.
//
// The styleguide's one promise is that it cannot lie: it reads the tokens at runtime, so it
// can't drift into a pretty fiction. A hand-maintained "which module uses what" map would
// break that promise inside a fortnight. So this script derives it: it walks src/modules,
// records every import of a shared primitive, and counts the places a module is still
// hand-rolling something the system already owns.
//
//   node scripts/ds-coverage.mjs        → src/modules/styleguide/coverage.generated.json
//
// Run it after touching primitives (npm run ds:coverage). If the JSON changes, the debt moved.

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const MODULES_DIR = join(ROOT, "src", "modules");
const UI_DIR = join(ROOT, "src", "shared", "components", "ui");
const OUT = join(MODULES_DIR, "styleguide", "coverage.generated.json");

// Modules that aren't product surfaces — they can't "adopt" anything.
const NOT_A_MODULE = new Set(["styleguide"]);

// The primitives we actually consider part of the system. A file in shared/ui that nobody is
// meant to reach for (internal shadcn plumbing) would only add noise.
const PRIMITIVES = readdirSync(UI_DIR)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => f.replace(/\.tsx$/, ""))
  .sort();

// ── The off-system signals ───────────────────────────────────────────────────────────────
// Each one is a thing the design system already answers. A hit means a screen answered it
// itself. These are counted, not judged — the number IS the argument.
const SMELLS = [
  {
    key: "arbitrary-type",
    label: "Off-scale type",
    // text-[13px] and friends. `text-[color:...]` and `text-(--var)` are colour, not size.
    re: /\btext-\[(?!color:|--)[^\]]*\]/g,
    fix: "use a type token (text-caption / micro / label / body / title)",
  },
  {
    key: "arbitrary-radius",
    label: "Off-scale radius",
    re: /\brounded-(?:[a-z]+-)?\[[^\]]+\]/g,
    fix: "use a radius token (rounded-chip / control / tile / card / modal)",
  },
  {
    key: "handrolled-glass",
    label: "Hand-rolled glass",
    re: /\bbackdrop-blur\b|backdropFilter/g,
    fix: "use the glass-thin / glass / glass-panel material",
  },
  {
    key: "raw-scrim",
    label: "Raw black scrim chip",
    // bg-black/60 on something small = a badge someone drew by hand.
    re: /\bbg-black\/\d+/g,
    fix: "use <Badge variant=\"glass\"> or the OVERLAY_CIRCLE",
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(p)) out.push(p);
  }
  return out;
}

const IMPORT_RE = /from\s+["']@\/shared\/components\/ui\/([a-z0-9-]+)["']/g;

const modules = {};
for (const name of readdirSync(MODULES_DIR)) {
  if (NOT_A_MODULE.has(name)) continue;
  const dir = join(MODULES_DIR, name);
  if (!statSync(dir).isDirectory()) continue;

  const files = walk(dir);
  const uses = new Set();
  const smells = {};
  const worst = {};   // the file with the most hits, per smell — where to start

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(IMPORT_RE)) uses.add(m[1]);

    for (const s of SMELLS) {
      const n = (src.match(s.re) ?? []).length;
      if (!n) continue;
      smells[s.key] = (smells[s.key] ?? 0) + n;
      if (!worst[s.key] || n > worst[s.key].n) {
        worst[s.key] = { file: relative(ROOT, file).replace(/\\/g, "/"), n };
      }
    }
  }

  modules[name] = {
    files: files.length,
    uses: [...uses].sort(),
    smells,
    worst,
  };
}

// Adoption per primitive — the column that tells you what nobody has picked up yet.
const adoption = {};
for (const p of PRIMITIVES) {
  adoption[p] = Object.entries(modules)
    .filter(([, m]) => m.uses.includes(p))
    .map(([name]) => name)
    .sort();
}

const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  primitives: PRIMITIVES,
  smells: SMELLS.map(({ key, label, fix }) => ({ key, label, fix })),
  modules,
  adoption,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

const total = Object.values(modules).reduce(
  (acc, m) => acc + Object.values(m.smells).reduce((a, b) => a + b, 0),
  0,
);
console.log(
  `✓ ${relative(ROOT, OUT)}\n` +
    `  ${PRIMITIVES.length} primitives · ${Object.keys(modules).length} modules · ${total} off-system hits`,
);
