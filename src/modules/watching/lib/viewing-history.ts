import type { WatchDateParts } from "./watched-date";

export interface ViewingDate {
  year: number | null; month: number | null; day: number | null;
  date_precision: "YEAR" | "MONTH" | "DAY" | "UNKNOWN";
}
export function viewingDate(parts?: WatchDateParts | null): ViewingDate {
  if (!parts) return { year: null, month: null, day: null, date_precision: "UNKNOWN" };
  const { year, month, day } = parts;
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) ||
      (day !== null && (month === null || !Number.isInteger(day) || day < 1 || day > monthDays(year, month)))) {
    throw new Error("Invalid viewing date");
  }
  return { year, month, day, date_precision: month === null ? "YEAR" : day === null ? "MONTH" : "DAY" };
}
function monthDays(year: number, month: number): number {
  return [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31][month - 1];
}
/** Only explicitly supplied input, NEVER a legacy timestamp. */
export function parseViewingInput(input: string): WatchDateParts {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(input);
  if (!match) throw new Error("Expected a year, month or day");
  const parts = { year: Number(match[1]), month: match[2] ? Number(match[2]) : null, day: match[3] ? Number(match[3]) : null };
  viewingDate(parts);
  return parts;
}
export interface ViewingRange {
  season_key: string; season_number_at_recording: number;
  episode_from: number; episode_to: number; episode_ids: number[] | null;
  minutes: number | null; duration_basis: "RUNTIME_SNAPSHOT" | "UNKNOWN" | "MILESTONE";
}
export interface ViewingAssertion extends ViewingDate {
  kind: "FIRST_WATCH" | "REWATCH" | "COMPLETION";
  scope_kind: "WHOLE_TITLE" | "SEASON" | "COUR" | "EPISODES" | "UNKNOWN";
  scope_key: string | null; completion_basis: "AVAILABLE_SCOPE" | "FINISHED_TITLE" | null;
  date_confidence: "CONFIRMED" | "INFERRED" | "UNKNOWN";
  scope_confidence: "CONFIRMED" | "INFERRED" | "UNKNOWN";
  origin: "USER_ACTION" | "USER_CORRECTION";
  supersedes_id?: string; ranges: ViewingRange[];
}
export interface StoredViewingAssertion extends ViewingAssertion { id: string; recorded_at?: string; }
export interface HistoryFacts {
  type: string; watched?: boolean; current_season?: number | null; current_episode?: number | null;
  season_aired?: number[] | null; runtime?: number | null;
  season_years?: Record<string, number> | null; cour_years?: Record<string, number> | null;
}
export interface HistoryMetadata {
  history_date?: WatchDateParts | null;
  history_intent?: "viewing" | "correction" | "claim";
  expected_revision?: number;
}
function range(season: number, from: number, to: number, runtime?: number | null): ViewingRange {
  const known = runtime != null && runtime >= 0;
  return { season_key: season === 0 ? "movie" : `tmdb-season:${season}`, season_number_at_recording: season,
    episode_from: from, episode_to: to, episode_ids: null,
    minutes: known ? (to - from + 1) * runtime : null, duration_basis: known ? "RUNTIME_SNAPSHOT" : "UNKNOWN" };
}
/** Freeze only bounded, known aired coverage; never fall back to announced counts. */
export function positionCoverage(facts: HistoryFacts): ViewingRange[] {
  if (facts.type === "film") return facts.watched ? [range(0,1,1,facts.runtime)] : [];
  const season = facts.current_season ?? 1, episode = facts.current_episode ?? 0;
  return (facts.season_aired ?? []).flatMap((aired, i) => {
    const end = i + 1 < season ? aired : i + 1 === season ? Math.min(aired,episode) : 0;
    return end > 0 ? [range(i + 1,1,end,facts.runtime)] : [];
  });
}
export function assertion(kind: ViewingAssertion["kind"], date: ViewingDate, ranges: ViewingRange[], correction = false): ViewingAssertion {
  return { ...date, kind, scope_kind: ranges.length ? "EPISODES" : "UNKNOWN", scope_key: null,
    completion_basis: kind === "COMPLETION" ? "FINISHED_TITLE" : null,
    date_confidence: date.date_precision === "UNKNOWN" ? "UNKNOWN" : "CONFIRMED",
    scope_confidence: ranges.length ? "INFERRED" : "UNKNOWN",
    origin: correction ? "USER_CORRECTION" : "USER_ACTION",
    ranges: kind === "COMPLETION" ? ranges.map(r => ({ ...r, minutes: 0, duration_basis: "MILESTONE" })) : ranges };
}
/** Prospective assertions only. Existing position is a boundary, NOT reconstructed history. */
export function captureHistory(before: HistoryFacts | null, patch: Partial<HistoryFacts> & Record<string, unknown>, meta: HistoryMetadata,
  active: StoredViewingAssertion[] = []): { records: ViewingAssertion[]; retract_ids: string[] } {
  const after = { ...before, ...patch } as HistoryFacts;
  const previous = before ? positionCoverage(before) : [];
  const current = positionCoverage(after);
  const records: ViewingAssertion[] = [], retract_ids: string[] = [];
  const correction = meta.history_intent === "correction";
  const date = viewingDate(meta.history_date);
  const replace = (old: StoredViewingAssertion, replacement: ViewingAssertion | null) => {
    retract_ids.push(old.id);
    if (replacement) records.push({ ...replacement, supersedes_id: old.id, origin: "USER_CORRECTION" });
  };
  // A current posture change/provider count is not a retraction. Only a deliberate backwards
  // correction clips assertions, against the user's storage cursor, NEVER today's aired counts.
  const backwards = (after.current_season ?? 1) < (before?.current_season ?? 1) ||
    ((after.current_season ?? 1) === (before?.current_season ?? 1) && (after.current_episode ?? 0) < (before?.current_episode ?? 0));
  if (correction && (backwards || (after.type === "film" && patch.watched === false))) {
    for (const old of active.filter(r => r.kind !== "REWATCH")) {
      const clipped = old.ranges.flatMap(r => {
        const season = after.current_season ?? 1;
        const limit = after.type === "film" ? (after.watched ? 1 : 0)
          : r.season_number_at_recording < season ? r.episode_to
          : r.season_number_at_recording === season ? (after.current_episode ?? 0) : 0;
        const end = Math.min(r.episode_to, limit);
        if (end < r.episode_from) return [];
        const count = end - r.episode_from + 1;
        return [{ ...r, episode_to: end, episode_ids: r.episode_ids?.slice(0,count) ?? null,
          minutes: r.minutes === null ? null : r.minutes * count / (r.episode_to - r.episode_from + 1) }];
      });
      if (old.kind === "COMPLETION" && JSON.stringify(clipped) !== JSON.stringify(old.ranges)) replace(old,null);
      else if (JSON.stringify(clipped) !== JSON.stringify(old.ranges)) replace(old, clipped.length ? { ...old, ranges: clipped } : null);
    }
  }
  if (meta.history_date !== undefined && after.type === "film") {
    const originals = active.filter(r => r.kind !== "REWATCH" && !retract_ids.includes(r.id));
    for (const old of originals) replace(old,{ ...old, ...date, date_confidence: date.date_precision === "UNKNOWN" ? "UNKNOWN" : "CONFIRMED" });
    if (!originals.length && after.watched) records.push(assertion("FIRST_WATCH",date,current,true));
  } else {
    const added = current.flatMap(r => {
      const oldEnd = previous.find(p => p.season_key === r.season_key)?.episode_to ?? 0;
      const start = Math.max(r.episode_from,oldEnd + 1);
      return start <= r.episode_to ? [range(r.season_number_at_recording,start,r.episode_to,after.runtime)] : [];
    });
    for (const coverage of added) {
      records.push({ ...assertion("FIRST_WATCH",date,[coverage],correction),
        scope_kind: after.type === "film" ? "WHOLE_TITLE" : "SEASON", scope_key: coverage.season_key });
    }
    const forward = (after.current_season ?? 1) > (before?.current_season ?? 1) ||
      ((after.current_season ?? 1) === (before?.current_season ?? 1) && (after.current_episode ?? 0) > (before?.current_episode ?? 0));
    if (!added.length && forward && !(after.watched && !before?.watched)) records.push(assertion("FIRST_WATCH",date,[],correction));
  }
  // Explicit year-map edits carry YEAR precision. Automatic status stamping is not an input date.
  if (!meta.history_intent) {
    for (const column of ["season_years", "cour_years"] as const) {
      if (!(column in patch)) continue;
      for (const key of Object.keys(before?.[column] ?? {})) {
        if (key in (after[column] ?? {})) continue;
        const scopeKey = `${column === "cour_years" ? "cour" : "tmdb-season"}:${key}`;
        for (const old of active.filter(r => r.scope_key === scopeKey && !retract_ids.includes(r.id))) {
          replace(old, { ...old, ...viewingDate(), date_confidence: "UNKNOWN" });
        }
      }
      for (const [key, year] of Object.entries(after[column] ?? {})) {
        if (before?.[column]?.[key] === year) continue;
        const scopeKey = `${column === "cour_years" ? "cour" : "tmdb-season"}:${key}`;
        const originals = active.filter(r => r.scope_key === scopeKey && !retract_ids.includes(r.id));
        const ranges = column === "season_years" ? current.filter(r => r.season_number_at_recording === Number(key)) : [];
        const fact = { ...assertion("FIRST_WATCH",viewingDate({ year, month: null, day: null }),ranges,true),
          scope_kind: column === "cour_years" ? "COUR" as const : "SEASON" as const, scope_key: scopeKey };
        if (originals.length) originals.forEach(old => replace(old,{ ...fact, ranges: old.ranges }));
        else records.push(fact);
      }
    }
  }
  if (after.watched && !before?.watched) records.push(assertion("COMPLETION",date,current,correction));
  return { records, retract_ids };
}
