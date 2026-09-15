// The Wikidata half of watching-awards-sync — a query and a normaliser, no I/O to Supabase, so it
// can be run locally with `deno run -A wikidata.ts` (see the bottom) before anything is deployed.
//
// WHAT WIKIDATA LOOKS LIKE (measured on the real endpoint, 2026-09-15)
//   · An award statement lives on the WORK (`Oppenheimer → award received: Best Actor`) AND on the
//     PERSON (`Cillian Murphy → award received: Best Actor, for work: Oppenheimer`). For Best Picture
//     it also lives on every PRODUCER. Same fact, two or three carriers.
//   · Only the person-side statement names the person; only a work with a TMDB id can be shown.
//     So: a row is a (work, person?) pair; the work must carry P4947 (film) or P4983 (series),
//     either directly or through the person statement's P1686 qualifier.
//   · P585 on the statement is the CEREMONY year. Nominations (P1411) sometimes lack it — then
//     the work's release year + 1 stands in, flagged.
//   · The label service returns the raw QID for some people bound inside OPTIONALs — a second,
//     cheap `wbgetentities` call fixes the handful that slip through.

export interface AwardCategory {
  key: string;
  ceremony: "oscars" | "emmys";
  subject: "work" | "person";
  qids: string[];
}

export interface AwardRow {
  ceremony: "oscars" | "emmys";
  category: string;
  year: number;
  year_inferred: boolean;
  won: boolean;
  work_qid: string;
  work_tmdb_id: number;
  work_type: "film" | "serie";
  work_title: string;
  person_qid: string; // "" when the award goes to the work itself
  person_tmdb_id: number | null;
  person_name: string | null;
}

const WD_SPARQL = "https://query.wikidata.org/sparql";
const WD_API = "https://www.wikidata.org/w/api.php";
const WD_UA = "HEGON/1.0 (https://hegon.fr; awards sync from Wikidata)";

/** One query per category: wins (P166) ∪ nominations (P1411), on whatever entity carries them. */
export function buildQuery(qids: string[], since: number | null): string {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const yearFilter = since ? `FILTER(!BOUND(?year) || ?year >= ${since})` : "";
  return `
SELECT ?x ?xLabel ?xFilm ?xTv ?xPerson ?work ?workLabel ?wFilm ?wTv ?year ?won ?pub WHERE {
  VALUES ?cat { ${values} }
  { ?x p:P166 ?s . ?s ps:P166 ?cat . BIND(true AS ?won) }
  UNION
  { ?x p:P1411 ?s . ?s ps:P1411 ?cat . BIND(false AS ?won) }
  OPTIONAL { ?s pq:P585 ?t . }
  OPTIONAL { ?s pq:P1686 ?work .
             OPTIONAL { ?work wdt:P4947 ?wFilm . }
             OPTIONAL { ?work wdt:P4983 ?wTv . } }
  OPTIONAL { ?x wdt:P4947 ?xFilm . }
  OPTIONAL { ?x wdt:P4983 ?xTv . }
  OPTIONAL { ?x wdt:P4985 ?xPerson . }
  # A carrier we cannot link (a producer with no TMDB id) is dropped HERE, not after a 3 MB
  # download: Best Picture is carried by every producer of every nominee.
  FILTER(BOUND(?xFilm) || BOUND(?xTv) || BOUND(?xPerson))
  BIND(YEAR(?t) AS ?year)
  ${yearFilter}
  OPTIONAL { ?x wdt:P577 ?pub . FILTER(!BOUND(?year)) }
  # "mul" = Wikidata's "same in every language" label — since 2024 many NAMES (Christopher Nolan,
  # Denzel Washington) live ONLY there, with no "en" label at all. Without it they come back as
  # raw QIDs. Measured 2026-09-15: 51 people, 12 works.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}`;
}

type Binding = Record<string, { value: string } | undefined>;

const qid = (v?: { value: string }) => (v ? v.value.replace("http://www.wikidata.org/entity/", "") : null);
const int = (v?: { value: string }) => (v && /^\d+$/.test(v.value) ? Number(v.value) : null);
const isRawQid = (s: string | null) => !!s && /^Q\d+$/.test(s);

/**
 * Bindings → rows, deduplicated on the natural key. The merge rules:
 *   · a (year, work) that has at least one person-side row drops its bare work-side row — the
 *     person row says strictly more;
 *   · the same (year, work, person) seen as both win and nomination is a win;
 *   · an inferred year never overrides a stated one.
 */
export function normalize(bindings: Binding[], cat: AwardCategory, since: number | null = null): AwardRow[] {
  const rows = new Map<string, AwardRow>();
  const personRowsFor = new Set<string>(); // `${year}|${work_qid}` that have a person row

  for (const b of bindings) {
    const x = qid(b.x)!;
    const xFilm = int(b.xFilm), xTv = int(b.xTv), xPerson = int(b.xPerson);
    let work_qid: string, work_tmdb_id: number | null, work_type: "film" | "serie", work_title: string;
    let person_qid = "", person_tmdb_id: number | null = null, person_name: string | null = null;

    if (xFilm || xTv) {
      // The statement is on the work itself.
      work_qid = x; work_tmdb_id = xFilm ?? xTv; work_type = xFilm ? "film" : "serie"; work_title = b.xLabel?.value ?? x;
    } else if (b.work && (int(b.wFilm) || int(b.wTv))) {
      // The statement is on a person (or a producer, a studio…) and names the work.
      const wFilm = int(b.wFilm), wTv = int(b.wTv);
      work_qid = qid(b.work)!; work_tmdb_id = wFilm ?? wTv; work_type = wFilm ? "film" : "serie"; work_title = b.workLabel?.value ?? work_qid;
      // A WORK award (Best Picture) is carried by its producers on Wikidata: they are how we find
      // the work, not a credit we show — the row collapses onto the work itself.
      if (cat.subject === "person") { person_qid = x; person_tmdb_id = xPerson; person_name = b.xLabel?.value ?? null; }
    } else {
      continue; // nothing we can show
    }

    let year = int(b.year);
    let year_inferred = false;
    if (!year) {
      const pub = b.pub?.value ? Number(b.pub.value.slice(0, 4)) : null;
      if (!pub) continue;
      year = pub + 1; year_inferred = true;
    }
    // The SPARQL filter lets year-less statements through (they may be recent); the inferred
    // year decides now, so a monthly run does not re-touch the 1930s.
    if (since && year < since) continue;

    const key = `${year}|${work_qid}|${person_qid}`;
    const won = b.won?.value === "true";
    const prev = rows.get(key);
    if (prev) {
      prev.won = prev.won || won;
      if (prev.year_inferred && !year_inferred) { prev.year = year; prev.year_inferred = false; }
      if (!prev.person_name && person_name) prev.person_name = person_name;
      if (!prev.person_tmdb_id && person_tmdb_id) prev.person_tmdb_id = person_tmdb_id;
      continue;
    }
    rows.set(key, {
      ceremony: cat.ceremony, category: cat.key, year, year_inferred, won,
      work_qid, work_tmdb_id: work_tmdb_id!, work_type, work_title,
      person_qid, person_tmdb_id, person_name,
    });
    if (person_qid) personRowsFor.add(`${year}|${work_qid}`);
  }

  // An INFERRED year loses to a STATED one for the same work: the film-side statement often has
  // no date while the person-side one does, and "release + 1" then invented a second Brutalist
  // (2026) next to the real one (2025). Measured on Best Actor, 2026-09-15.
  const statedWorks = new Set([...rows.values()].filter((r) => !r.year_inferred).map((r) => r.work_qid));
  return [...rows.values()].filter((r) =>
    // Drop the bare work rows shadowed by a person row of the same (year, work).
    (r.person_qid !== "" || !personRowsFor.has(`${r.year}|${r.work_qid}`)) &&
    (!r.year_inferred || !statedWorks.has(r.work_qid)));
}

export async function runQuery(query: string, fetchImpl: typeof fetch = fetch): Promise<Binding[]> {
  const url = `${WD_SPARQL}?format=json&query=${encodeURIComponent(query)}`;
  const r = await fetchImpl(url, { headers: { "User-Agent": WD_UA, Accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error(`Wikidata ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = await r.json();
  return json?.results?.bindings ?? [];
}

/** The label service misses some people bound inside OPTIONALs; ask for those labels directly. */
export async function fillLabels(rows: AwardRow[], fetchImpl: typeof fetch = fetch): Promise<number> {
  const missing = new Set<string>();
  for (const r of rows) {
    if (isRawQid(r.work_title)) missing.add(r.work_qid);
    if (r.person_qid && (!r.person_name || isRawQid(r.person_name))) missing.add(r.person_qid);
  }
  if (missing.size === 0) return 0;
  const labels = new Map<string, string>();
  const ids = [...missing];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `${WD_API}?action=wbgetentities&format=json&props=labels&languages=en|mul&ids=${batch.join("|")}`;
    const r = await fetchImpl(url, { headers: { "User-Agent": WD_UA } });
    if (!r.ok) continue;
    const json = await r.json();
    for (const [id, e] of Object.entries<any>(json.entities ?? {})) {
      // English, then "mul" (a name), then anything — a foreign title still beats a raw QID.
      const l = e?.labels?.en?.value ?? e?.labels?.mul?.value ?? (Object.values<any>(e?.labels ?? {})[0]?.value as string | undefined);
      if (l) labels.set(id, l);
    }
  }
  let fixed = 0;
  for (const r of rows) {
    if (isRawQid(r.work_title) && labels.has(r.work_qid)) { r.work_title = labels.get(r.work_qid)!; fixed++; }
    if (r.person_qid && (!r.person_name || isRawQid(r.person_name)) && labels.has(r.person_qid)) { r.person_name = labels.get(r.person_qid)!; fixed++; }
  }
  return fixed;
}

/** Everything for one category: query → normalise → labels. */
export async function fetchCategory(cat: AwardCategory, since: number | null, fetchImpl: typeof fetch = fetch): Promise<AwardRow[]> {
  const bindings = await runQuery(buildQuery(cat.qids, since), fetchImpl);
  const rows = normalize(bindings, cat, since);
  await fillLabels(rows, fetchImpl);
  return rows;
}

// ── Local probe: `deno run -A supabase/functions/watching-awards-sync/wikidata.ts best_actor Q103916 [since] [work]`
if (import.meta.main) {
  const [key, qidsArg, sinceArg, subjectArg] = Deno.args;
  const cat: AwardCategory = { key, ceremony: "oscars", subject: subjectArg === "work" ? "work" : "person", qids: qidsArg.split(",") };
  const t0 = Date.now();
  const rows = await fetchCategory(cat, sinceArg ? Number(sinceArg) : null);
  console.log(`${rows.length} rows in ${Date.now() - t0} ms · wins ${rows.filter((r) => r.won).length} · inferred years ${rows.filter((r) => r.year_inferred).length} · no person name ${rows.filter((r) => r.person_qid && !r.person_name).length} · bare work rows ${rows.filter((r) => !r.person_qid).length} · distinct works ${new Set(rows.map((r) => r.year + r.work_qid)).size}`);
  for (const r of rows.sort((a, b) => b.year - a.year).slice(0, 12)) console.log(r.year, r.won ? "W" : "n", r.work_title, `(${r.work_tmdb_id})`, r.person_name ?? "", r.person_tmdb_id ?? "");
}
