// TheSportsDB team resolution — shared by the enrich route and the artwork picker.
//
// The naive `searchteams.php?t=<name>` + "first soccer result" is WRONG in three common ways, all
// seen live:
//   • the stored name carries a club suffix/prefix ("Arsenal FC" matches a random "Tunari"; "FC
//     Bayern München" / "Club Atlético de Madrid" don't match at all),
//   • a hyphen blocks the match ("Paris Saint-Germain FC" → 0 results; "Paris Saint Germain" → hit),
//   • the first soccer result is the WOMEN'S team ("Liverpool FC" → "Liverpool FC Women").
// So we try cleaned name variants (cleaned FIRST, raw last), keep only MEN'S soccer teams, and accept
// a candidate only on an exact normalized name or a shared significant token with the club name.

const TSDB = "https://www.thesportsdb.com/api/v1/json/3";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TsdbTeam {
  idTeam?: string;
  strTeam?: string;
  strSport?: string;
  strGender?: string;
  strFanart1?: string; strFanart2?: string; strFanart3?: string; strFanart4?: string;
  strBanner?: string; strDescriptionEN?: string; intStadiumCapacity?: string;
  strWebsite?: string; intFormedYear?: string; strCountry?: string;
  idVenue?: string;
  [k: string]: any;
}

interface TsdbVenue {
  strFanart1?: string; strFanart2?: string; strFanart3?: string; strFanart4?: string;
  [k: string]: any;
}

const deaccent = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => deaccent(s).toLowerCase().replace(/[^a-z0-9]/g, "");

const SUFFIX = /\s+(fc|cf|afc|sc|ac|fk|sk|bk|if|sv|cd|ud|rc|as|ss|us)$/i;
const PREFIX = /^(fc|afc|ac|as|ss|club|cd|rc|sv|ssc|ogc|rcd)\s+/i;
const CLUB_WORDS = new Set(["fc", "cf", "afc", "sc", "ac", "fk", "sk", "bk", "if", "sv", "cd", "ud", "rc", "as", "ss", "us", "club", "de", "futbol", "fussball", "calcio", "the"]);

const significantTokens = (s: string) =>
  deaccent(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !CLUB_WORDS.has(w));

const shareToken = (club: string, team: string) => {
  const c = new Set(significantTokens(club));
  return significantTokens(team).some((t) => c.has(t));
};

function nameVariants(name: string): string[] {
  const b = name.trim();
  const noSuf = b.replace(SUFFIX, "").trim();
  const noPre = noSuf.replace(PREFIX, "").trim();
  const out: string[] = [];
  const add = (x: string) => { const v = x?.trim(); if (v && !out.includes(v)) out.push(v); };
  add(deaccent(noPre).replace(/-/g, " ")); // most cleaned first
  add(noPre.replace(/-/g, " "));
  add(noPre);
  add(deaccent(noSuf));
  add(noSuf);
  add(deaccent(b));
  add(b); // raw last
  return out;
}

const isMensClub = (t: TsdbTeam) =>
  /soccer|football/i.test(t.strSport || "") &&
  (t.strGender || "").toLowerCase() !== "female" &&
  !/women|ladies|u1\d|u2\d|youth|reserves?|academy/i.test(t.strTeam || "");

async function searchTeams(name: string): Promise<TsdbTeam[]> {
  try {
    const r = await fetch(`${TSDB}/searchteams.php?t=${encodeURIComponent(name)}`, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!r.ok) return [];
    return (await r.json())?.teams ?? [];
  } catch {
    return [];
  }
}

/** Resolve a stored (football-data) team name to the correct MEN'S TheSportsDB team, or null. */
export async function resolveTsdbTeam(name: string): Promise<TsdbTeam | null> {
  let best: TsdbTeam | null = null;
  for (const v of nameVariants(name)) {
    const men = (await searchTeams(v)).filter(isMensClub);
    if (!men.length) continue;
    const target = norm(v);
    const exact = men.find((t) => norm(t.strTeam || "") === target);
    if (exact) return exact;
    if (!best) {
      const tok = men.find((t) => shareToken(name, t.strTeam || ""));
      if (tok) best = tok;
    }
  }
  return best;
}

// Only the CSP-allowed image hosts (cdn/r2). The venue THUMB lives on www.thesportsdb.com, which the
// CSP img-src does NOT allow, so it would render blank — filtered out here, not offered as a choice.
const ALLOWED_IMG = /^https:\/\/(cdn|r2)\.thesportsdb\.com\//i;

/** The team's OWN artwork: 4 fanarts + banner (whatever exists). */
export function backdropsOf(t: TsdbTeam): { url: string; label: string }[] {
  return [
    { url: t.strFanart1, label: "Fanart 1" },
    { url: t.strFanart2, label: "Fanart 2" },
    { url: t.strFanart3, label: "Fanart 3" },
    { url: t.strFanart4, label: "Fanart 4" },
    { url: t.strBanner, label: "Banner" },
  ].filter((x): x is { url: string; label: string } => typeof x.url === "string" && ALLOWED_IMG.test(x.url));
}

async function lookupVenue(id: string): Promise<TsdbVenue | null> {
  try {
    const r = await fetch(`${TSDB}/lookupvenue.php?id=${encodeURIComponent(id)}`, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json())?.venues?.[0] ?? null;
  } catch {
    return null;
  }
}

/** ALL backdrop candidates for the picker: the club's own fanarts/banner PLUS the STADIUM's fanarts
 *  (the team record has no stadium image — but its idVenue does, via lookupvenue). Deduped by URL. */
export async function collectBackdrops(team: TsdbTeam): Promise<{ url: string; label: string }[]> {
  const out = backdropsOf(team);
  if (team.idVenue) {
    const v = await lookupVenue(team.idVenue);
    if (v) {
      [v.strFanart1, v.strFanart2, v.strFanart3, v.strFanart4]
        .filter((u): u is string => typeof u === "string" && ALLOWED_IMG.test(u))
        .forEach((url, i) => out.push({ url, label: `Stadium ${i + 1}` }));
    }
  }
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.url) ? false : (seen.add(b.url), true)));
}
