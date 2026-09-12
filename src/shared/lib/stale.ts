// La tolérance à la donnée périmée — LE SEUL endroit où un `staleTime` s'écrit en chiffres.
//
// POURQUOI CE FICHIER EXISTE (doctrine système, règle R4 — hq/rules/system-design.md)
// Au 2026-09-12, 129 `useQuery` déclaraient 126 `staleTime` dans 78 fichiers, chacun décidant
// pour lui : 51 recopiaient le défaut de 5 min sans le savoir, la même minute s'écrivait
// `60 * 1000`, `1000 * 60` et `60_000`. Le réglage global de QueryProvider ne gouvernait
// que 10 requêtes sur 129. Il n'y avait pas de doctrine de cache, il y avait 78 fichiers.
//
// LA RÈGLE : un hook choisit un PALIER ici, jamais un nombre. Une règle ESLint
// (`no-restricted-syntax`, eslint.config.mjs) refuse tout `staleTime:` qui n'est pas
// `STALE.<palier>` — le mécanisme, pas la discipline.
//
// ⚠️ CE PREMIER PASSAGE PRÉSERVE LE COMPORTEMENT. Chaque site a reçu le palier égal à sa
// valeur d'avant (2 min reste 2 min). Les noms disent la DURÉE, pas encore l'intention :
// c'est l'audit de chaque module (phase 3, axe 4) qui décidera, requête par requête, si
// cette donnée est « la mienne » (un seul écrivain, l'invalidation suffit) ou « celle des
// robots » (staleTime = cadence du cron qui la remplit), et qui fera fondre cette table.
//
// ⚠️ MULTI-APPAREIL : un staleTime long n'est PAS un problème de vitesse mais de justesse —
// un film noté sur le téléphone n'apparaît pas sur l'onglet PC tant que la requête n'est ni
// périmée ni remontée. Le levier est `refetchOnMount` / `refetchOnWindowFocus`, pas la durée.
// Voir la règle R4 pour ce qui est tranché.
//
// ⚠️ UN PALIER NE DIT SA DURÉE QUE SI `gcTime` SUIT. `staleTime` = « fraîche pendant X » ;
// `gcTime` = « gardée en mémoire X sans observateur » (10 min par défaut, QueryProvider). Une
// donnée `STALE.DAY` sans `gcTime` est RAMASSÉE après 10 min hors écran, puis refetchée : le
// palier est un mensonge. Règle : tout palier > TEN_MINUTES déclare `gcTime: STALE.<le même>`
// (ou plus). Cliquet : `stale.test.ts` lit le code et échoue sur chaque site qui ment.
// Trouvé au contre-examen du 2026-09-13 — 21 sites, dont un commenté « Cached a day » avec 10 min.
// Pourquoi pas un gcTime global d'une semaine ? Parce que TOUT resterait en mémoire une semaine
// dans un onglet longue durée ; le couple explicite ne coûte que là où on l'a voulu.

export const STALE = {
  /** 0 — refetch à chaque montage. Pour ce qui vient peut-être de changer ailleurs (autre
   *  surface, autre appareil) et doit être juste tout de suite. */
  NONE: 0,
  /** 30 s — quasi-direct : recherche, autocomplétion, un match en cours. */
  HALF_MINUTE: 30 * 1000,
  /** 1 min */
  MINUTE: 60 * 1000,
  /** 2 min */
  TWO_MINUTES: 2 * 60 * 1000,
  /** 5 min — LE DÉFAUT de QueryProvider. Ne l'écris JAMAIS dans un hook : hérite. Il n'existe
   *  ici que pour que QueryProvider lui-même passe la règle. */
  DEFAULT: 5 * 60 * 1000,
  /** 10 min */
  TEN_MINUTES: 10 * 60 * 1000,
  /** 30 min */
  HALF_HOUR: 30 * 60 * 1000,
  /** 1 h */
  HOUR: 60 * 60 * 1000,
  /** 24 h — une référence externe qui ne bouge pas dans la journée (fiche TMDB, OMDb). */
  DAY: 24 * 60 * 60 * 1000,
  /** 7 j */
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;
