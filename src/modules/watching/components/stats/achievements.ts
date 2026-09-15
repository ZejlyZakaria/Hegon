import type { Achievement } from "@/shared/components/achievements/types";
import type { StatsRawItem } from "../../service";
import type { HoursEntry, RewatchEntry } from "./computeStats";

/**
 * THE TWELVE, AS RULES — a SHAPE with PARAMETERS, not twelve hand-written counters.
 *
 * "Time Traveler · span 8 decades" is `distinct(decade of release) ≥ 8`. "Auteur · 12 by one
 * director" is `largest group(director) ≥ 12`. "Cinephile · 350 films" is `count(films) ≥ 350`.
 * Every badge the module has fits one of five shapes; the shape is what can EXPLAIN itself — which
 * titles counted, how far you are, when the bar was cleared — and the parameters are what a user
 * could one day set from a form (decisions: the editable set is deferred, the shape is not).
 *
 *   count     — how many titles pass a filter                     → cinephile, series_devotee, otaku, connoisseur, hall_of_fame
 *   distinct  — how many different values of a dimension you own  → time_traveler (decade), genre_nomad (genre), ever_present (month)
 *   max_group — the largest group along a dimension               → auteur (director), big_year (year watched)
 *   max       — the largest single value                          → long_hauler (episodes of one show)
 *   sum       — a total across items                              → marathoner (hours)
 *
 * All-time, over COMPLETED titles. Pure: no I/O, no React.
 */

type Base = Pick<Achievement, "key" | "name" | "icon" | "color" | "description">;
type Bucket = { key: string; label: string };

export type Rule = Base & { goal: number } & (
  | { shape: "count"; of: (i: StatsRawItem) => boolean; /** What would count once finished — the carrot. */ candidate?: (i: StatsRawItem) => boolean }
  | { shape: "distinct"; by: (i: StatsRawItem) => Bucket[]; unit: string }
  | { shape: "max_group"; by: (i: StatsRawItem) => Bucket[]; unit: string }
  | { shape: "max"; of: (i: StatsRawItem) => number; unit: string }
  | { shape: "sum"; unit: string }
);

/** One line of the "why": a group of titles under a label (a decade, a director, or just "Counted"). */
export interface DetailGroup {
  label: string;
  items: StatsRawItem[];
  /** The number this group contributes (its size, or its measure). */
  value: number;
}

export interface AchievementDetail {
  /** Which of the five shapes produced this — the panel lays each one out differently. */
  shape: Rule["shape"];
  value: number;
  goal: number;
  unit: string;
  /** How the number was reached — a sentence a person can check. */
  formula: string;
  /** The titles (or groups of titles) that produced the number, strongest first. */
  groups: DetailGroup[];
  /** When the bar was cleared — the finish date of the title that tipped it. Null when unknown. */
  unlockedAt: string | null;
  /** Still to go, and — when the rule can say — what would count once finished. */
  remaining: number;
  candidates: StatsRawItem[];
}

export interface WatchingAchievement extends Achievement {
  detail: AchievementDetail;
}

const decadeOf = (i: StatsRawItem) => (i.year ? [{ key: String(Math.floor(i.year / 10) * 10), label: `${Math.floor(i.year / 10) * 10}s` }] : []);
const genresOf = (i: StatsRawItem) => (i.tags ?? []).map((t) => ({ key: t, label: t }));
const monthOf = (i: StatsRawItem) => {
  if (!i.watched_at) return [];
  const d = new Date(i.watched_at);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return [{ key, label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) }];
};
const yearOf = (i: StatsRawItem) => (i.watched_at ? [{ key: String(new Date(i.watched_at).getFullYear()), label: String(new Date(i.watched_at).getFullYear()) }] : []);
const directorsOf = (i: StatsRawItem) => {
  const seen = new Set<number>();
  return (i.directors ?? []).filter((p) => p?.id && !seen.has(p.id) && seen.add(p.id)).map((p) => ({ key: String(p.id), label: p.name }));
};
/** Episodes of a show, AIRED over announced — the same ruler Quick Stats uses. */
const episodesOf = (i: StatsRawItem) =>
  i.type === "film" ? 0 : (i.season_aired ?? i.season_episodes)?.reduce((a, b) => a + (b || 0), 0) || i.episodes || 0;

// Harmonised jewel tones — one cohesive set on graphite, told apart by icon + colour at a glance.
// Thresholds are calibrated against a real, heavy library (≈270 films, ≈2,800 h) so the set stays
// *a bit hard*: a few earned, several near 90 %, always a carrot just ahead.
export const RULES: Rule[] = [
  { key: "cinephile",      name: "Cinephile",      icon: "clapperboard",  color: "#2dd4bf", description: "Watch 350 films",             goal: 350,  shape: "count", of: (i) => i.type === "film" },
  { key: "series_devotee", name: "Series Devotee", icon: "tv",            color: "#7f9cf5", description: "Finish 30 series",             goal: 30,   shape: "count", of: (i) => i.type === "serie", candidate: (i) => i.type === "serie" && i.in_progress },
  { key: "otaku",          name: "Otaku",          icon: "sparkles",      color: "#e6973f", description: "Finish 50 animes",             goal: 50,   shape: "count", of: (i) => i.type === "anime", candidate: (i) => i.type === "anime" && i.in_progress },
  { key: "marathoner",     name: "Marathoner",     icon: "clock",         color: "#e57ba3", description: "Watch 3,000 hours",            goal: 3000, shape: "sum", unit: "hours" },
  { key: "connoisseur",    name: "Connoisseur",    icon: "gem",           color: "#4fc59b", description: "Rate 25 titles 9 or higher",   goal: 25,   shape: "count", of: (i) => (i.user_rating ?? 0) >= 9 },
  { key: "hall_of_fame",   name: "Hall of Fame",   icon: "trophy",        color: "#e8b64c", description: "Award 15 perfect 10s",         goal: 15,   shape: "count", of: (i) => (i.user_rating ?? 0) >= 10 },
  { key: "time_traveler",  name: "Time Traveler",  icon: "calendarRange", color: "#58b0e0", description: "Span 8 decades of release",    goal: 8,    shape: "distinct", by: decadeOf, unit: "decades" },
  { key: "genre_nomad",    name: "Genre Nomad",    icon: "globe",         color: "#a98bf0", description: "Explore 25 genres",            goal: 25,   shape: "distinct", by: genresOf, unit: "genres" },
  { key: "auteur",         name: "Auteur",         icon: "medal",         color: "#e5776b", description: "Watch 12 by one director",     goal: 12,   shape: "max_group", by: directorsOf, unit: "titles" },
  { key: "big_year",       name: "Big Year",       icon: "flame",         color: "#db8f5a", description: "Watch 50 in one year",         goal: 50,   shape: "max_group", by: yearOf, unit: "titles" },
  { key: "long_hauler",    name: "Long Hauler",    icon: "layers",        color: "#6f9ce0", description: "Finish a 100-episode series",  goal: 100,  shape: "max", of: episodesOf, unit: "episodes" },
  { key: "ever_present",   name: "Ever-Present",   icon: "calendarCheck", color: "#b98fd4", description: "Active across 120 months",     goal: 120,  shape: "distinct", by: monthOf, unit: "months" },
];

const byDateAsc = (a: StatsRawItem, b: StatsRawItem) => (a.watched_at ?? "9999").localeCompare(b.watched_at ?? "9999");
const byDateDesc = (a: StatsRawItem, b: StatsRawItem) => (b.watched_at ?? "").localeCompare(a.watched_at ?? "");

/**
 * Evaluate one rule — the number AND its working. `hours` is the all-time itemised breakdown the
 * Hours donut sums (the same pass, so Marathoner can never disagree with it).
 */
export function evaluate(rule: Rule, items: StatsRawItem[], hours: HoursEntry[], totalHours: number, rewatches: RewatchEntry[] = []): WatchingAchievement {
  const completed = items.filter((i) => i.watched);
  let value = 0;
  let groups: DetailGroup[] = [];
  let unlockedAt: string | null = null;
  let candidates: StatsRawItem[] = [];
  let formula = "";
  let unit = "titles";

  switch (rule.shape) {
    case "count": {
      const hits = completed.filter(rule.of);
      value = hits.length;
      groups = [{ label: "Counted", items: [...hits].sort(byDateDesc), value }];
      // The bar was cleared by the goal-th title in the order you finished them.
      const dated = [...hits].filter((i) => i.watched_at).sort(byDateAsc);
      unlockedAt = value >= rule.goal && dated.length >= rule.goal ? dated[rule.goal - 1].watched_at : null;
      candidates = rule.candidate ? items.filter((i) => !i.watched && rule.candidate!(i)) : [];
      formula = `${value} of your finished titles match — ${rule.description.toLowerCase()}.`;
      break;
    }
    case "distinct": {
      unit = rule.unit;
      const buckets = new Map<string, DetailGroup & { first: string | null }>();
      for (const i of [...completed].sort(byDateAsc)) {
        for (const b of rule.by(i)) {
          const g = buckets.get(b.key) ?? { label: b.label, items: [], value: 0, first: i.watched_at };
          g.items.push(i); g.value = g.items.length;
          buckets.set(b.key, g);
        }
      }
      value = buckets.size;
      // A decade or a month is read most recent first, like the person timeline; a genre A→Z.
      const chronological = [...buckets.keys()].every((k) => /^\d/.test(k));
      groups = [...buckets.entries()]
        .sort(([ka, a], [kb, b]) => (chronological ? kb.localeCompare(ka) : a.label.localeCompare(b.label)))
        .map(([, g]) => g);
      for (const g of groups) g.items.sort(byDateDesc);
      // The goal-th DIFFERENT value to appear, in the order you finished things.
      const firsts = [...buckets.values()].map((g) => g.first).filter((d): d is string => !!d).sort();
      unlockedAt = value >= rule.goal && firsts.length >= rule.goal ? firsts[rule.goal - 1] : null;
      formula = `${value} different ${rule.unit} across your finished titles — ${rule.description.toLowerCase()}.`;
      break;
    }
    case "max_group": {
      unit = rule.unit;
      const buckets = new Map<string, DetailGroup>();
      for (const i of completed) {
        for (const b of rule.by(i)) {
          const g = buckets.get(b.key) ?? { label: b.label, items: [], value: 0 };
          g.items.push(i); g.value = g.items.length;
          buckets.set(b.key, g);
        }
      }
      groups = [...buckets.values()].sort((a, b) => b.value - a.value).slice(0, 10);
      value = groups[0]?.value ?? 0;
      for (const g of groups) g.items.sort(byDateDesc);
      if (groups[0]) {
        const dated = [...groups[0].items].filter((i) => i.watched_at).sort(byDateAsc);
        unlockedAt = value >= rule.goal && dated.length >= rule.goal ? dated[rule.goal - 1].watched_at : null;
      }
      formula = groups[0]
        ? `Your largest group is ${groups[0].label} with ${value} ${rule.unit} — ${rule.description.toLowerCase()}.`
        : rule.description;
      break;
    }
    case "max": {
      unit = rule.unit;
      const ranked = completed.map((i) => ({ i, v: rule.of(i) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      value = ranked[0]?.v ?? 0;
      groups = ranked.slice(0, 10).map(({ i, v }) => ({ label: i.title, items: [i], value: v }));
      unlockedAt = value >= rule.goal ? (ranked[0]?.i.watched_at ?? null) : null;
      formula = ranked[0]
        ? `Your longest finished show is ${ranked[0].i.title}, ${value} ${rule.unit} — ${rule.description.toLowerCase()}.`
        : rule.description;
      break;
    }
    case "sum": {
      unit = rule.unit;
      // THE DONUT'S NUMBER, not a second sum — rewatches included, exactly what "Hours watched"
      // says on All time. The entries below only show where it came from.
      value = Math.round(totalHours);
      const top = [...hours].sort((a, b) => b.minutes - a.minutes).slice(0, 10);
      groups = top.map((h) => ({ label: h.item.title, items: [h.item], value: Math.round(h.minutes / 60) }));
      // Cumulative, in the order you watched things — first viewings AND rewatches, since the total
      // counts both: the sitting that pushed it over the bar. (Without the rewatches the bar can be
      // crossed with no date to show for it.)
      const sittings = [
        ...hours.filter((h) => h.item.watched_at).map((h) => ({ on: h.item.watched_at!, minutes: h.minutes })),
        ...rewatches.map((r) => ({ on: r.watchedOn, minutes: r.minutes })),
      ].sort((a, b) => a.on.localeCompare(b.on));
      let acc = 0;
      for (const s of sittings) {
        acc += s.minutes;
        if (acc / 60 >= rule.goal) { unlockedAt = s.on; break; }
      }
      formula = `${value.toLocaleString("en-GB")} hours across everything you finished, rewatches included — ${rule.description.toLowerCase()}.`;
      break;
    }
  }

  const unlocked = value >= rule.goal;
  return {
    key: rule.key,
    name: rule.name,
    icon: rule.icon,
    color: rule.color,
    description: rule.description,
    unlocked,
    progress: rule.goal <= 0 ? 1 : Math.min(1, value / rule.goal),
    progressLabel: unlocked ? "Unlocked" : `${value.toLocaleString("en-GB")} / ${rule.goal.toLocaleString("en-GB")}`,
    detail: { shape: rule.shape, value, goal: rule.goal, unit, formula, groups, unlockedAt, remaining: Math.max(0, rule.goal - value), candidates },
  };
}

/**
 * `totalHours` and `hours` come from ONE all-time `computeStats` pass — the same figure the Hours
 * donut shows, so Marathoner can never disagree with it.
 */
export function computeWatchingAchievements(items: StatsRawItem[], totalHours: number, hours: HoursEntry[], rewatches: RewatchEntry[] = []): WatchingAchievement[] {
  return RULES.map((r) => evaluate(r, items, hours, totalHours, rewatches));
}
