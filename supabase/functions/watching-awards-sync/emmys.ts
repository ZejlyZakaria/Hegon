// The emmys.com half of watching-awards-sync — pure fetch + parsing, no Supabase, shared by the
// edge function (monthly, one year) and the local backfill (`scripts/backfill-award-emmys.ts`).
//
// WHY NOT WIKIDATA FOR THE EMMYS (measured 2026-09-15): 98/98 Best Picture winners are there, but
// 19 Outstanding Comedy Series in 70 years and zero awards on Ted Lasso — never entered. emmys.com
// (the Television Academy) publishes on every category page a schema.org JSON-LD `ItemList`:
// the series, the credited people, "… Winner" or "… Nominee", back to 1949. Structured data the
// site emits for machines — no HTML scraping. What it does NOT have is an id of any kind.
//
// So the join is a RESOLUTION, and it says how sure it is (`match`):
//   · TMDB search on the title, kept only if it started on or before the ceremony year → 'name';
//   · when Wikipedia knows the title, its Wikidata item's TMDB id (P4983 / P4947) is an ID, and
//     it wins over the search → 'id';
//   · nothing plausible → the row is kept without an id → 'none' (counted, never guessed).

export interface EmmyCategory {
  key: string;
  subject: "work" | "person";
  /** Regex source matched against the emmys.com slug (the slugs drifted over the decades). */
  emmy_slug: string;
}

export interface EmmyRow {
  ceremony: "emmys";
  category: string;
  year: number;
  year_inferred: false;
  won: boolean;
  work_qid: string;            // "emmys:<show-slug>" — the site's own stable key
  work_tmdb_id: number | null;
  work_type: "film" | "serie";
  work_title: string;
  person_qid: string;          // "emmys:<bio-slug>" or ""
  person_tmdb_id: number | null;
  person_name: string | null;
  source: "emmys";
  match: "id" | "name" | "none";
}

const SITE = "https://www.emmys.com";
const UA = "HEGON/1.0 (https://hegon.fr; awards sync)";
const TMDB = "https://api.themoviedb.org/3";

type Fetch = typeof fetch;
const text = async (u: string, f: Fetch) => {
  const r = await f(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${u} → ${r.status}`);
  return await r.text();
};

/** The category slugs a ceremony year has. */
export async function listYearSlugs(year: number, f: Fetch = fetch): Promise<string[]> {
  const t = await text(`${SITE}/awards/nominees-winners/${year}`, f);
  return [...new Set([...t.matchAll(new RegExp(`nominees-winners/${year}/([a-z0-9-]+)`, "g"))].map((m) => m[1]))];
}

interface LdPerson { "@type": "Person"; name: string; url?: string }
interface LdItem { "@type": string; name: string; url?: string; award?: string; actor?: LdPerson[]; director?: LdPerson[]; author?: LdPerson[]; creator?: LdPerson[] }

/** One category page → its nominees (the JSON-LD ItemList), or [] when the page has none. */
export async function readCategoryPage(year: number, slug: string, f: Fetch = fetch): Promise<{ item: LdItem; won: boolean }[]> {
  const t = await text(`${SITE}/awards/nominees-winners/${year}/${slug}`, f);
  const blocks = [...t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const ld = blocks.find((b) => b.includes('"ItemList"'));
  if (!ld) return [];
  let list: { itemListElement?: { item: LdItem }[] };
  try { list = JSON.parse(ld); } catch { return []; }
  return (list.itemListElement ?? []).map((e) => e.item).filter((i) => i?.name).map((item) => ({ item, won: /winner/i.test(item.award ?? "") }));
}

const slugOf = (url?: string) => (url ?? "").split("/").filter(Boolean).pop() ?? "";

/**
 * The site glues the UMBRELLA to the title: "Columbo NBC Sunday Mystery Movie", "Brian's Song
 * Movie of the Week", "Bleak House (Masterpiece Theatre)", "Heartsounds An ABC Theater
 * Presentation". The work is the play; the umbrella is the slot it aired in. Measured on the
 * first backfill: the bulk of the 477 unresolved titles.
 */
const UMBRELLAS = [
  "NBC Sunday Mystery Movie", "NBC Mystery Movie", "NBC Wednesday Mystery Movie", "Wednesday Movie of the Week", "Movie of the Week",
  "Masterpiece Theatre", "Masterpiece Theater", "Masterpiece", "Hallmark Hall of Fame Presentation", "Hallmark Hall of Fame",
  "Great Performances", "American Playhouse", "CBS Playhouse", "An ABC Theatre Presentation", "An ABC Theater Presentation",
  "ABC Theatre", "ABC Theater", "Live from Lincoln Center",
];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function cleanTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  // A trailing parenthetical naming an umbrella (the closing bracket is sometimes missing).
  const paren = t.match(/^(.*?)\s*\(([^)]*)\)?\s*$/);
  if (paren && UMBRELLAS.some((u) => paren[2].toLowerCase().includes(u.toLowerCase()))) t = paren[1];
  for (const u of UMBRELLAS) {
    const re = new RegExp("\\s+" + escapeRe(u) + "\\s*$", "i");
    if (re.test(t)) { t = t.replace(re, ""); break; }
  }
  // A trailing "(1981)" is a year, not a title: TMDB matches the bare title.
  return t.replace(/\s*\(\d{4}\)\s*$/, "").trim();
}
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ── Resolution ─────────────────────────────────────────────────────────────────

export interface Resolver {
  /** `kind` comes back only when the work was found as the OTHER kind (a TV movie in a series category). */
  work(title: string, kind: "tv" | "movie", year: number): Promise<{ tmdb: number | null; match: "id" | "name" | "none"; kind?: "tv" | "movie" }>;
  person(name: string, workTmdb: number | null): Promise<number | null>;
}

/**
 * TMDB search + Wikidata cross-check, memoised per title (a show nominated ten years running is
 * resolved once). `tmdbKey` is the v3 api key.
 */
export function makeResolver(tmdbKey: string, f: Fetch = fetch): Resolver {
  const works = new Map<string, Promise<{ tmdb: number | null; match: "id" | "name" | "none"; kind?: "tv" | "movie" }>>();
  const people = new Map<string, Promise<number | null>>();
  const json = async (u: string) => { const r = await f(u, { headers: { "User-Agent": UA } }); return r.ok ? await r.json() : null; };

  const tmdbSearch = async (title: string, kind: "tv" | "movie", year: number): Promise<number | null> => {
    const d = await json(`${TMDB}/search/${kind}?api_key=${tmdbKey}&query=${encodeURIComponent(title)}&include_adult=false`);
    const rs: { id: number; name?: string; title?: string; first_air_date?: string; release_date?: string; popularity: number }[] = d?.results ?? [];
    const want = norm(title);
    // Started on or before the ceremony year (a nominee cannot postdate its ceremony), title
    // matching after normalisation; the most popular of what remains.
    const ok = rs.filter((r) => {
      const y = Number((r.first_air_date ?? r.release_date ?? "").slice(0, 4));
      return (!y || y <= year) && norm(r.name ?? r.title ?? "") === want;
    });
    const pool = ok.length ? ok : rs.filter((r) => { const y = Number((r.first_air_date ?? r.release_date ?? "").slice(0, 4)); return !y || y <= year; });
    if (!pool.length) return null;
    return pool.sort((a, b) => b.popularity - a.popularity)[0].id;
  };

  const wikidataId = async (title: string, kind: "tv" | "movie", year: number): Promise<number | null> => {
    // Wikipedia search → page → wikibase item → P4983 (TV) / P4947 (film).
    const q = `${title} ${kind === "tv" ? "television series" : "film"}`;
    const s = await json(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=8&format=json&formatversion=2`);
    const hits: { title: string; pageid: number }[] = (s?.query?.search ?? []).filter((p: { title: string }) => norm(p.title).startsWith(norm(title)));
    // Homonyms: "Scoop (2006 film)" vs "Scoop (2024 film)", "Mr. & Mrs. Smith (1996 TV series)" vs
    // "(2024 TV series)". The first hit is not the nominee; the one whose parenthetical year is
    // the LATEST at or before the ceremony year is. A title with no year at all is a plain page.
    const dated = hits.map((h) => ({ h, y: Number((h.title.match(/\((\d{4})/) ?? [])[1]) || null })).filter((x) => !x.y || x.y <= year);
    const pick = dated.filter((x) => x.y).sort((a, b) => b.y! - a.y!)[0] ?? dated[0];
    const hit = pick?.h;
    if (!hit) return null;
    const pp = await json(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&pageids=${hit.pageid}&format=json&formatversion=2`);
    const qid = pp?.query?.pages?.[0]?.pageprops?.wikibase_item;
    if (!qid) return null;
    const e = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`);
    const claim = e?.entities?.[qid]?.claims?.[kind === "tv" ? "P4983" : "P4947"]?.[0]?.mainsnak?.datavalue?.value;
    return claim && /^\d+$/.test(claim) ? Number(claim) : null;
  };

  return {
    work(rawTitle, kind, year) {
      const title = cleanTitle(rawTitle);
      const k = `${kind}:${norm(title)}`;
      let p = works.get(k);
      if (!p) {
        p = (async () => {
          const [byName, byId] = await Promise.all([tmdbSearch(title, kind, year), wikidataId(title, kind, year).catch(() => null)]);
          if (byId) return { tmdb: byId, match: "id" as const };
          if (byName) return { tmdb: byName, match: "name" as const };
          // A TV movie filed under "limited series" (Behind the Candelabra) is a MOVIE on TMDB,
          // and an anthology play the other way round: try the other kind before giving up.
          const other = kind === "tv" ? "movie" : "tv";
          const [altName, altId] = await Promise.all([tmdbSearch(title, other, year), wikidataId(title, other, year).catch(() => null)]);
          if (altId) return { tmdb: altId, match: "id" as const, kind: other };
          if (altName) return { tmdb: altName, match: "name" as const, kind: other };
          // An EPISODE honoured on its own ("USS Callister (Black Mirror)", "Sherlock: The Lying
          // Detective"): TMDB has no such title, but it has the series — and the series is what
          // the Museum shows. The parenthetical names it, else the part before the colon.
          const paren = rawTitle.match(/\(([^)]+)\)\s*$/)?.[1];
          const series = paren && !/^\d{4}$/.test(paren) ? paren : rawTitle.includes(":") ? rawTitle.split(":")[0] : null;
          if (series && norm(series) !== norm(title)) {
            const [sName, sId] = await Promise.all([tmdbSearch(series, "tv", year), wikidataId(series, "tv", year).catch(() => null)]);
            if (sId) return { tmdb: sId, match: "name" as const, kind: "tv" as const };
            if (sName) return { tmdb: sName, match: "name" as const, kind: "tv" as const };
          }
          return { tmdb: null, match: "none" as const };
        })();
        works.set(k, p);
      }
      return p;
    },
    person(name, workTmdb) {
      const k = norm(name);
      let p = people.get(k);
      if (!p) {
        p = (async () => {
          const d = await json(`${TMDB}/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(name)}&include_adult=false`);
          const rs: { id: number; name: string; popularity: number; known_for?: { id: number }[] }[] = d?.results ?? [];
          const exact = rs.filter((r) => norm(r.name) === k);
          const pool = exact.length ? exact : rs;
          if (!pool.length) return null;
          // Prefer the one TMDB already links to the nominated show; else the best-known namesake.
          const linked = workTmdb ? pool.find((r) => r.known_for?.some((w) => w.id === workTmdb)) : null;
          return (linked ?? pool.sort((a, b) => b.popularity - a.popularity)[0]).id;
        })();
        people.set(k, p);
      }
      return p;
    },
  };
}

/** One ceremony year, our categories only → rows. */
export async function fetchEmmyYear(year: number, cats: EmmyCategory[], resolver: Resolver, f: Fetch = fetch, log: (s: string) => void = () => {}): Promise<EmmyRow[]> {
  const slugs = await listYearSlugs(year, f);
  const rows: EmmyRow[] = [];
  // Pages sequentially (one site, be polite); the RESOLUTION of a page's nominees in parallel —
  // sequential it was ~110 s a year, 2 h for the backfill.
  for (const cat of cats) {
    const re = new RegExp(cat.emmy_slug);
    const slug = slugs.find((s) => re.test(s));
    if (!slug) continue;
    const items = await readCategoryPage(year, slug, f);
    const kind = cat.key === "outstanding_television_movie" ? "movie" : "tv";
    const perItem = await Promise.all(items.map(async ({ item, won }) => {
      const showSlug = slugOf(item.url) || norm(item.name).replace(/ /g, "-");
      const { tmdb, match, kind: found } = await resolver.work(item.name, kind, year);
      const realKind = found ?? kind;
      const base = {
        ceremony: "emmys" as const, category: cat.key, year, year_inferred: false as const, won,
        work_qid: `emmys:${showSlug}`, work_tmdb_id: tmdb, work_type: realKind === "movie" ? "film" as const : "serie" as const,
        work_title: item.name, source: "emmys" as const, match,
      };
      const credited = cat.subject === "person" ? [...(item.actor ?? []), ...(item.director ?? []), ...(item.author ?? []), ...(item.creator ?? [])] : [];
      if (!credited.length) return [{ ...base, person_qid: "", person_tmdb_id: null, person_name: null } as EmmyRow];
      return Promise.all(credited.map(async (p) => ({
        ...base, person_qid: `emmys:${slugOf(p.url) || norm(p.name).replace(/ /g, "-")}`, person_tmdb_id: await resolver.person(p.name, tmdb), person_name: p.name,
      } as EmmyRow)));
    }));
    rows.push(...perItem.flat());
    log(`${year} ${cat.key}: ${items.length} nominees`);
  }
  // The same person can be credited twice on one nominee (actor AND creator): one row per key.
  const seen = new Set<string>();
  return rows.filter((r) => { const k = `${r.category}|${r.year}|${r.work_qid}|${r.person_qid}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
