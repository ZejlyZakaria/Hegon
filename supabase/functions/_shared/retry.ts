// Le cliquet R7 des edge functions — un fetch qui réessaie UNE fois.
//
// POURQUOI (2026-09-13)
// Le watchdog a trouvé une panne récurrente : `Competitions fetch failed: Gateway Timeout`
// dans football_sync_standings — un 504 de l'API REST **Supabase** sur 13 lignes, pas de
// football-data — et watching-series-sync mort sur un select media_items. Cause probable :
// 12 crons sur 15 partaient à la minute :00, jusqu'à 4 fonctions la même seconde contre une
// base Free (migration 20260913000000 les décale). Mais un décalage ne rend pas la base
// infaillible : une fonction qui meurt au premier 5xx transitoire perd 4 à 6 h de synchro.
//
// QUOI
// `fetchWithRetry` : signature de `fetch`, réessaie une fois après 2 s sur erreur réseau,
// 408 ou 5xx. Deux usages :
//   - supabase-js : `createClient(url, key, { global: { fetch: fetchWithRetry } })` — une
//     ligne, et TOUS les appels REST du client sont couverts, sans toucher aux 40 `.from()`.
//   - fetch brut vers `${SUPABASE_URL}/rest/v1/…` (les 6 fonctions football) : remplacer
//     `fetch(` par `fetchWithRetry(`.
//
// ⚠️ Un réessai rejoue aussi les ÉCRITURES. C'est sans dégât parce que les robots écrivent en
// `upsert` (règle R5) ; les 3 `insert` de tennis sont une dette R5 annotée, à corriger là-bas.
// Pas de réessai sur 4xx (403, 404, 429) : ce n'est pas transitoire, et sur 429 réessayer
// brûle du quota.
//
// `errMsg` : un catch qui fait `String(e)` sur une PostgrestError affiche `[object Object]`
// — c'est ce qui a rendu la panne illisible. Toujours passer par ici.

const RETRY_DELAY_MS = 2_000;

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function retryable(status: number): boolean {
  return status === 408 || status >= 500;
}

export const fetchWithRetry: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init);
    if (!retryable(res.status)) return res;
    // Le corps n'est lu par personne : on le libère avant de réessayer.
    await res.body?.cancel().catch(() => {});
  } catch {
    // erreur réseau / DNS / connexion coupée → on réessaie aussi
  }
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return fetch(input, init);
};
