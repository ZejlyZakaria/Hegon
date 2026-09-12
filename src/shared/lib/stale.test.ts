// Le cliquet de la règle R4 (doctrine de cache) que le lint ne peut pas tenir seul.
//
// ESLint garantit qu'un `staleTime` est un palier de STALE. Il ne peut pas comparer deux
// propriétés entre elles — or un palier au-dessus du gcTime par défaut (10 min) ne vaut que si
// l'objet déclare aussi `gcTime ≥ staleTime`. Sans ça, TanStack ramasse la donnée dès qu'elle
// n'a plus d'observateur, AVANT qu'elle soit périmée : « fraîche 24 h » devient « refetch après
// 10 min hors écran ». Contre-examen du 2026-09-13 : 21 sites mentaient ainsi, dont un commenté
// « Cached a day » avec 10 min de gcTime.
//
// Ce test lit le code source, pas l'AST : c'est volontairement grossier, mais le motif
// `staleTime: STALE.X` est imposé par le lint, donc la grep est fiable.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { STALE } from "./stale";

const GC_DEFAULT_MS = 10 * 60 * 1000; // QueryProvider — la seule autre valeur de gcTime « par défaut »

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

function evalTime(expr: string): number {
  // `STALE.DAY`, `60 * 60 * 1000`, `60_000`… — un sous-ensemble arithmétique, rien d'autre.
  const safe = expr.replace(/STALE\.([A-Z_]+)/g, (_, k: keyof typeof STALE) => String(STALE[k]));
  if (!/^[\d\s*+_().]+$/.test(safe)) return NaN;
  return Function(`return (${safe.replace(/_/g, "")})`)() as number;
}

describe("R4 — un palier au-dessus de 10 min porte son gcTime", () => {
  const root = join(__dirname, "..", "..");
  const files = [...walk(join(root, "modules")), ...walk(join(root, "shared"))];
  const offenders: string[] = [];

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/staleTime:\s*STALE\.([A-Z_]+)/g)) {
      const tier = STALE[m[1] as keyof typeof STALE];
      if (tier <= GC_DEFAULT_MS) continue;
      const block = src.slice(src.lastIndexOf("{", m.index), src.indexOf("}", m.index));
      const gc = block.match(/gcTime:\s*([^,\n]+)/);
      const gcMs = gc ? evalTime(gc[1]) : null;
      if (gcMs === null || !(gcMs >= tier)) {
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${file.replace(root, "src")}:${line} — staleTime STALE.${m[1]} sans gcTime ≥ (${gc ? gc[1] : "défaut 10 min"})`);
      }
    }
  }

  it("aucun palier ne ment sur sa durée", () => {
    expect(offenders, "\n" + offenders.join("\n")).toEqual([]);
  });
});
