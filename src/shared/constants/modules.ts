// Canonical module catalog — the single source for module keys, labels, routes
// and accents. The Sidebar (icons) and Settings (default module + Dock
// visibility) both build on this so the two never drift.

export type ModuleGroup = "Life" | "Perso" | "Pro";

export interface ModuleMeta {
  key: string;
  label: string;
  group: ModuleGroup;
  route: string;
  /** Path prefix that marks this module active / owns its sub-routes
   *  (e.g. Watching has /perso/watching/movies, /library, /[id]…). Defaults to `route`. */
  activePrefix?: string;
  accent: string;
  comingSoon?: boolean;
}

/** The prefix that all of a module's routes live under. */
export function modulePrefix(m: ModuleMeta): string {
  return m.activePrefix ?? m.route;
}

export const DASHBOARD_MODULE: ModuleMeta = {
  key: "dashboard",
  label: "Dashboard",
  group: "Life",
  route: "/dashboard",
  accent: "#60a5fa",
};

export const MODULES: ModuleMeta[] = [
  { key: "goals",    label: "Goals",    group: "Life",  route: "/life/goals",            accent: "#22c55e" },
  { key: "habits",   label: "Habits",   group: "Life",  route: "/life/habits",           accent: "#8b5cf6" },
  { key: "journal",  label: "Journal",  group: "Life",  route: "/life/journal",          accent: "#f97316" },
  { key: "books",    label: "Books",    group: "Life",  route: "/life/books",            accent: "#0ea5e9" },
  { key: "sport",    label: "Sport",    group: "Perso", route: "/perso/sports/football", activePrefix: "/perso/sports",   accent: "#10b981" },
  { key: "watching", label: "Watching", group: "Perso", route: "/perso/watching/movies", activePrefix: "/perso/watching", accent: "#8b5cf6" },
  { key: "travel",   label: "Travel",   group: "Perso", route: "/perso/travel",          accent: "#0ea5e9", comingSoon: true },
  { key: "fitness",  label: "Fitness",  group: "Perso", route: "/perso/fitness",         accent: "#f97316", comingSoon: true },
  { key: "tasks",    label: "Tasks",    group: "Pro",   route: "/pro/tasks",             accent: "#71717a" },
  { key: "jobhunt",  label: "Job Hunt", group: "Pro",   route: "/pro/jobhunt",           accent: "#3b82f6", comingSoon: true },
  { key: "tech",     label: "Tech",     group: "Pro",   route: "/pro/tech",              accent: "#06b6d4", comingSoon: true },
];

// Modules that are actually shipped (toggleable in the Dock, selectable as home).
export const LIVE_MODULES = MODULES.filter((m) => !m.comingSoon);
