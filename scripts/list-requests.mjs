// La LISTE des requêtes d'un chargement de page — l'instrument de l'axe 3 (cascades) des audits
// de phase 3, complément de `measure-cache.mjs` qui COMPTE mais ne dit pas QUOI.
//
// Pour chaque appel Supabase (REST / storage / auth) et chaque route /api/* : l'instant depuis la
// navigation, la table et le filtre. On y lit les vagues (les instants se regroupent) et le
// par-carte (la même table, un `eq.` différent, N fois). C'est ce qui a montré, le 2026-09-13, que
// /perso/watching/animes partait à 60 requêtes là où `measure-cache.mjs` en comptait 15 :
// 44 `anime_cours tmdb_id=eq.X`, une par carte, dupliquant les 4 batches déjà partis.
//
// USAGE (serveur de prod lancé, session enregistrée par `node scripts/auth-setup.mjs`) :
//   node scripts/list-requests.mjs perso/watching/animes
// ⚠️ Chemin SANS slash initial — Git Bash sur Windows convertit `/perso/...` en chemin de fichier.

import { chromium } from "playwright";
import { existsSync } from "fs";

const STATE = "scripts/.auth/storageState.json";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PATHNAME = "/" + (process.argv[2] || "perso/watching/movies").replace(/^\/+/, "");

if (!existsSync(STATE)) {
  console.error(`✗ Pas de session dans ${STATE}. Lance : node scripts/auth-setup.mjs`);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const calls = [];
const t0 = Date.now();
page.on("request", (r) => {
  const u = r.url();
  if (/supabase\.co\/(rest|storage|auth)\//.test(u) || u.includes("/api/")) {
    calls.push({ at: Date.now() - t0, url: u, method: r.method() });
  }
});
await page.goto(`${BASE}${PATHNAME}`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/auth")) {
  console.error("✗ La session enregistrée est expirée — relance : node scripts/auth-setup.mjs");
  await browser.close();
  process.exit(1);
}
// Silence réseau de 1,5 s = fin du chargement. Sur un serveur FROID la première réponse peut
// dépasser ce délai et couper la liste : lancer une fois pour chauffer, lire la seconde.
let last = Date.now(), n = 0;
while (Date.now() - last < 1500 && Date.now() - t0 < 20000) {
  await page.waitForTimeout(100);
  if (calls.length !== n) { n = calls.length; last = Date.now(); }
}
await context.close();
await browser.close();

const summarize = (u) => {
  try {
    const url = new URL(u);
    if (url.pathname.includes("/rest/v1/")) {
      const table = url.pathname.split("/rest/v1/")[1];
      const p = url.searchParams;
      const keys = [...p.keys()].filter((k) => k !== "select").map((k) => `${k}=${String(p.get(k)).slice(0, 40)}`);
      return `REST ${table.padEnd(22)} ${keys.join(" ")}`;
    }
    if (url.pathname.includes("/auth/v1/")) return `AUTH ${url.pathname.split("/auth/v1/")[1]}`;
    if (url.pathname.startsWith("/api/")) return `API  ${url.pathname} ${url.search.slice(0, 60)}`;
    return u.slice(0, 100);
  } catch {
    return u.slice(0, 100);
  }
};
const shown = calls.filter((c) => !c.url.includes("/envelope/")); // Sentry, pas des données
console.log(`\n${PATHNAME} — ${shown.length} appels (Sentry exclu)\n`);
for (const c of shown) console.log(String(c.at).padStart(5), "ms ", c.method.padEnd(5), summarize(c.url));
