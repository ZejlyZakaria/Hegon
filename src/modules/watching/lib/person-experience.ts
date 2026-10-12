import type { PersonTitle } from "../service";
import { mediaIdentity } from "./possession";
import { isDirectorCredit } from "./credit-roles";
export function isExperienced(t: { watched: boolean; in_progress: boolean; paused: boolean; dropped: boolean; release_date?: string | null; year?: number | null }, today = new Date().toISOString().slice(0, 10)): boolean {
  if (t.release_date && t.release_date > today) return false;
  if (!t.release_date && t.year != null && t.year > Number(today.slice(0, 4))) return false;
  return t.watched || t.in_progress || t.paused || t.dropped;
}
export interface CoPerson { id: number; name: string; profile_url: string | null; count: number; billing: number; isDirector: boolean; roleLabel: string }
export function collaborators(titles: PersonTitle[], personId: number): CoPerson[] {
  const map = new Map<number, CoPerson>();
  const counted = new Map<number, Set<string>>();
  for (const t of titles.filter((t) => isExperienced(t))) {
    const work = mediaIdentity(t.type, t.tmdb_id);
    const add = (p: { id?: number; name: string; profile_url?: string | null }, billing: number, isDirector: boolean, roleLabel: string) => {
      if (!p.id || p.id === personId) return;
      const works = counted.get(p.id) ?? new Set<string>();
      const prev = map.get(p.id);
      if (prev) {
        if (!works.has(work)) prev.count++;
        prev.billing = Math.min(prev.billing, billing);
        prev.isDirector = prev.isDirector && isDirector;
        if (roleLabel === "Actor" || prev.roleLabel === "Crew") prev.roleLabel = roleLabel;
        prev.profile_url ??= p.profile_url ?? null;
      } else map.set(p.id, { id: p.id, name: p.name, profile_url: p.profile_url ?? null, count: 1, billing, isDirector, roleLabel });
      works.add(work); counted.set(p.id, works);
    };
    t.cast_members.forEach((p, i) => add(p, i, false, "Actor"));
    t.directors.forEach((p) => add(p, 0, isDirectorCredit(p, t.type), isDirectorCredit(p, t.type) ? "Director" : p.role === "creator" ? "Creator" : "Crew"));
  }
  return [...map.values()].sort((a, b) => b.count - a.count || Number(a.isDirector) - Number(b.isDirector) || a.billing - b.billing || a.name.localeCompare(b.name) || a.id - b.id);
}

export function experienceSummary(titles: PersonTitle[]) {
  const byWork = new Map<string, PersonTitle>();
  for (const t of titles.filter((t) => isExperienced(t)).sort((a, b) => Number(b.watched) - Number(a.watched) || a.id.localeCompare(b.id))) {
    const key = mediaIdentity(t.type, t.tmdb_id);
    if (!byWork.has(key)) byWork.set(key, t);
  }
  const experienced = [...byWork.values()];
  const completed = experienced.filter((t) => t.watched);
  const rated = experienced.filter((t) => t.user_rating != null);
  const avgRating = rated.length ? rated.reduce((sum, t) => sum + t.user_rating!, 0) / rated.length : null;
  return { experienced, completed, rated, avgRating };
}
