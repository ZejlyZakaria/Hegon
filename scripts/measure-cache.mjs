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
// Combien d affiches TMDB dans le DOM pour compter « contenu réel » : 1 = la première vignette
// (bandeau tendances suffit), 40 = la grille des films de l utilisateur est rendue.
const MIN_POSTERS = Number((args.find((a) => a.startsWith("--min-posters=")) || "--min-posters=1").split("=")[1]);
const BASE = process.env.SHOOT_BASE || "http://localhost:3000";
const STATE = "scripts/.auth/storageState.json";

if (!existsSync(STATE)) {
  console.error(`✗ Pas de session dans ${STATE}. Lance : node scripts/auth-setup.mjs`);
  process.exit(1);
}

const isSupabase = (url) => /supabase\.co\/(rest|storage)\//.test(url);
const median = (xs) => {
  if (!xs.length) return null;
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

  // ⭐ LA MÉTRIQUE QUI COMPTE : le premier CONTENU RÉEL à l'écran, depuis la navigation.
  // Objection owner (2026-09-12) : « temps jusqu'à la dernière requête » vaut 0 par
  // construction quand il n'y a plus de requête — une définition, pas un résultat.
  // Ce que l'utilisateur voit, c'est le moment où le squelette laisse la place aux
  // vraies affiches : le premier <img> TMDB dans le DOM (le squelette n'en a aucun ;
  // la page chargée en a ~180). Horloge de la PAGE (`performance.now()`, origine =
  // navigation), donc comparable entre les deux bras. On relève au passage le premier
  // appel Supabase : c'est la fin de l'hydratation — le plancher que le cache ne peut
  // pas franchir, puisqu'il n'est lu qu'après.
  const paint = await page
    .waitForFunction(
      (min) => {
        if (document.querySelectorAll('img[src*="image.tmdb.org"]').length < min) return null;
        const sb = performance
          .getEntriesByType("resource")
          .filter((e) => /supabase\.co\/(rest|storage)\//.test(e.name));
        return {
          content: Math.round(performance.now()),
          firstReq: sb.length ? Math.round(Math.min(...sb.map((e) => e.startTime))) : null,
        };
      },
      MIN_POSTERS,
      { timeout: 20000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => ({ content: null, firstReq: null }));

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
  // ⚠️ Le persister écrit 1 s après le DERNIER événement de cache — et les requêtes
  // non-Supabase (/api/tmdb) finissent après que le réseau Supabase s'est tu. Sans
  // cette attente, le premier essai lisait localStorage avant l'écriture : « rien
  // écrit », et le bras B rejouait le bras A. Mesuré à 71 974 octets avec 4 s.
  if (persist) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
  }
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
  return { requests: calls.length, settled, content: paint.content, firstReq: paint.firstReq, written };
}

async function arm(label, { persist, seed }) {
  const runs = [];
  for (let i = 0; i <= RUNS; i++) {
    const r = await once({ persist, seed });
    if (i > 0) runs.push(r); // le premier passage est jeté (échauffement)
    process.stdout.write(".");
  }
  const num = (k) => median(runs.map((r) => r[k]).filter((v) => v !== null && v !== undefined));
  const out = {
    label,
    content: num("content"),
    firstReq: num("firstReq"),
    requests: num("requests"),
    settled: num("settled"),
  };
  console.log(
    `\n  ${label.padEnd(30)} contenu à ${String(out.content ?? "?").padStart(5)} ms · ` +
      `hydratation à ${String(out.firstReq ?? "—").padStart(5)} ms · ` +
      `${String(out.requests).padStart(2)} req. Supabase · réseau fini à ${String(out.settled).padStart(5)} ms`,
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

  const dContent = A.content - B.content;
  const pct = A.content ? Math.round((dContent / A.content) * 100) : 0;
  console.log(
    `\n  ⇒ contenu visible ${dContent} ms plus tôt (${pct} %) · ${A.requests - B.requests} requêtes en moins` +
      `${primed.written ? ` · ${Math.round(primed.written.length / 1024)} Ko sur le disque` : ""}` +
      `\n  ⇒ plancher = l'hydratation (~${B.firstReq ?? A.firstReq} ms) : le cache n'est lu qu'après, il ne le franchit pas\n`,
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
