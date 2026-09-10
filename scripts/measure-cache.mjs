// Mesure A/B — le cache TanStack persisté vaut-il le coup pour HEGON ?
//
// Question posée en phase 2 de l'audit : le cache vit en mémoire, donc chaque
// rechargement de page repart de zéro. Combien ça coûte, vraiment ?
//
// PROTOCOLE (règle projet : A/B chiffré, dos à dos, échauffé)
//   - même build, même serveur, même session, même page ;
//   - la persistance est un DRAPEAU lu dans localStorage → A et B tournent dans
//     la même exécution, à la suite, sans redémarrage ni recompilation ;
//   - N passages par bras, le premier jeté (échauffement du serveur et du CDN) ;
//   - on mesure ce qui est réellement en jeu : les requêtes Supabase d'un
//     chargement à froid, et le temps jusqu'à la dernière d'entre elles.
//
// USAGE
//   npm run build && npm start          (dans un autre terminal)
//   node scripts/measure-cache.mjs [/chemin] [--runs=5]

import { chromium } from "playwright";
import { existsSync } from "fs";

const args = process.argv.slice(2);
const PATHNAME = args.find((a) => a.startsWith("/")) || "/perso/watching/movies";
const RUNS = Number((args.find((a) => a.startsWith("--runs=")) || "--runs=5").split("=")[1]);
const BASE = process.env.SHOOT_BASE || "http://localhost:3000";
const STATE = "scripts/.auth/storageState.json";

if (!existsSync(STATE)) {
  console.error(`✗ Pas de session dans ${STATE}. Lance : node scripts/auth-setup.mjs`);
  process.exit(1);
}

const isSupabase = (url) => /supabase\.co\/(rest|storage)\//.test(url);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const browser = await chromium.launch();

/**
 * Un passage = un contexte neuf (donc un « onglet fermé puis rouvert »),
 * avec le disque du navigateur pré-rempli ou non selon le bras.
 */
async function once({ persist, seed }) {
  const context = await browser.newContext({
    storageState: STATE,
    viewport: { width: 1440, height: 900 },
  });

  // Le drapeau et, pour le bras B, le cache déjà sur le disque.
  await context.addInitScript(
    ([flag, cache]) => {
      try {
        if (flag) localStorage.setItem("hegon_persist_experiment", "1");
        else localStorage.removeItem("hegon_persist_experiment");
        if (cache) localStorage.setItem("hegon_query_cache", cache);
      } catch {}
    },
    [persist, seed ?? null],
  );

  const page = await context.newPage();
  const calls = [];
  page.on("response", (r) => {
    if (isSupabase(r.url())) calls.push({ url: r.url(), at: Date.now() });
  });

  const t0 = Date.now();
  await page.goto(`${BASE}${PATHNAME}`, { waitUntil: "domcontentloaded" });

  // Redirigé vers /auth ⇒ la session est morte, la mesure ne veut rien dire.
  if (page.url().includes("/auth")) {
    await context.close();
    throw new Error("SESSION_EXPIRED");
  }

  // On attend que le réseau Supabase se taise 1,2 s d'affilée.
  let last = Date.now();
  const seen = () => calls.length;
  let n = seen();
  while (Date.now() - last < 1200 && Date.now() - t0 < 20000) {
    await page.waitForTimeout(100);
    if (seen() !== n) {
      n = seen();
      last = Date.now();
    }
  }

  const settled = calls.length ? Math.max(...calls.map((c) => c.at)) - t0 : 0;

  // Le cache écrit par ce passage, pour semer le bras B.
  const written = await page
    .evaluate(() => {
      try {
        return localStorage.getItem("hegon_query_cache");
      } catch {
        return null;
      }
    })
    .catch(() => null);

  await context.close();
  return { requests: calls.length, settled, written };
}

async function arm(label, { persist, seed }) {
  const runs = [];
  for (let i = 0; i <= RUNS; i++) {
    const r = await once({ persist, seed });
    if (i > 0) runs.push(r); // le premier passage est jeté (échauffement)
    process.stdout.write(".");
  }
  const out = {
    label,
    requests: median(runs.map((r) => r.requests)),
    settled: median(runs.map((r) => r.settled)),
  };
  console.log(
    `\n  ${label.padEnd(34)} ${String(out.requests).padStart(3)} requêtes Supabase · ` +
      `${String(out.settled).padStart(5)} ms jusqu'à la dernière`,
  );
  return out;
}

console.log(`\nMesure A/B — ${PATHNAME} · ${RUNS} passages par bras (+1 jeté)\n`);

try {
  // Bras A — l'état actuel de HEGON : rien sur le disque.
  const A = await arm("A · sans persistance (actuel)", { persist: false });

  // On produit une fois le cache que le bras B trouvera sur le disque.
  process.stdout.write("  (préparation du cache disque)");
  const primed = await once({ persist: true });
  console.log(primed.written ? ` ${Math.round(primed.written.length / 1024)} Ko écrits` : " rien écrit");

  // Bras B — retour sur l'app, cache déjà présent.
  const B = await arm("B · avec persistance", { persist: true, seed: primed.written });

  const dReq = A.requests - B.requests;
  const dMs = A.settled - B.settled;
  const pct = A.settled ? Math.round((dMs / A.settled) * 100) : 0;
  console.log(
    `\n  ⇒ ${dReq} requêtes en moins · ${dMs} ms en moins (${pct} %)` +
      `${primed.written ? ` · ${Math.round(primed.written.length / 1024)} Ko sur le disque` : ""}\n`,
  );
} catch (e) {
  if (e.message === "SESSION_EXPIRED") {
    console.error(
      "\n✗ La session enregistrée est expirée — l'app redirige vers /auth.\n" +
        "  Relance : node scripts/auth-setup.mjs, puis relance cette mesure.\n",
    );
  } else {
    console.error("\n✗", e.message, "\n");
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
