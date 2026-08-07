import {
  LayoutDashboard,
  Target,
  Repeat2,
  NotebookPen,
  Library,
  Trophy,
  Tv,
  CheckSquare,
  Plane,
  Briefcase,
  Code2,
  type LucideIcon,
} from "lucide-react";

// ─── Module registry ────────────────────────────────────────────────────────
// Single source of truth for the home-screen apps. Tile gradients go vivid →
// deep (iOS app-icon gloss). `from`/`to` are explicit (not tokens) so a tile
// reads the same regardless of where it's rendered.
//
// NOTE (owner): which apps show on the dashboard — and their order — will be
// user-controlled later (Settings). Keep everything driven by this config +
// the ordered key arrays below; never hard-code a module list in a component.

export interface OsApp {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  from: string; // gradient top (vivid)
  to: string; // gradient bottom (deep)
  comingSoon?: boolean;
}

export const OS_APPS: Record<string, OsApp> = {
  dashboard: { key: "dashboard", label: "Home", href: "/dashboard", icon: LayoutDashboard, from: "#60a5fa", to: "#1e3a8a" },
  goals: { key: "goals", label: "Goals", href: "/life/goals", icon: Target, from: "#22c55e", to: "#0f3d28" },
  habits: { key: "habits", label: "Habits", href: "/life/habits", icon: Repeat2, from: "#8b5cf6", to: "#2e1065" },
  journal: { key: "journal", label: "Journal", href: "/life/journal", icon: NotebookPen, from: "#f97316", to: "#431407" },
  books: { key: "books", label: "Books", href: "/life/books", icon: Library, from: "#0ea5e9", to: "#082f49" },
  sport: { key: "sport", label: "Sport", href: "/perso/sports/football", icon: Trophy, from: "#B6FF2E", to: "#1a2e05" },
  watching: { key: "watching", label: "Watching", href: "/perso/watching/movies", icon: Tv, from: "#2dd4bf", to: "#0c3d4a" },
  tasks: { key: "tasks", label: "Tasks", href: "/pro/tasks", icon: CheckSquare, from: "#a1a1aa", to: "#3f3f46" },
  travel: { key: "travel", label: "Travel", href: "/perso/travel", icon: Plane, from: "#38bdf8", to: "#075985", comingSoon: true },
  jobhunt: { key: "jobhunt", label: "Job Hunt", href: "/pro/jobhunt", icon: Briefcase, from: "#3b82f6", to: "#1e3a8a", comingSoon: true },
  tech: { key: "tech", label: "Tech", href: "/pro/tech", icon: Code2, from: "#a855f7", to: "#581c87", comingSoon: true },
};

// Grid order — Life · Perso · Pro (mirrors the dock grouping). Default layout;
// becomes user-reorderable later.
export const GRID_APP_KEYS: string[] = [
  "goals", "habits", "journal", "books",
  "sport", "watching", "travel",
  "tasks", "jobhunt", "tech",
];

// Dock = the persistent "favorites" rail (live modules only). Home first.
export const DOCK_APP_KEYS: string[] = [
  "dashboard",
  "goals", "habits", "journal", "books",
  "sport", "watching",
  "tasks",
];

// ─── Wallpapers ─────────────────────────────────────────────────────────────
// CSS presets by default (no asset, recolorable, gives the glass something to
// refract). A user-supplied image URL plugs in here later via Settings.

export interface OsWallpaper {
  id: string;
  label: string;
  css: string;
}

export const OS_WALLPAPERS: OsWallpaper[] = [
  {
    id: "aurora-night",
    label: "Aurora Night",
    css: `
      radial-gradient(55% 45% at 16% 8%, rgba(109,112,255,0.62), transparent 62%),
      radial-gradient(50% 42% at 92% 14%, rgba(45,212,191,0.42), transparent 60%),
      radial-gradient(64% 60% at 82% 96%, rgba(150,100,255,0.58), transparent 64%),
      radial-gradient(48% 50% at 4% 96%, rgba(20,170,240,0.40), transparent 60%),
      linear-gradient(160deg, #11111f, #0c0c16 56%, #0e0e1a)
    `,
  },
  {
    id: "ember",
    label: "Ember",
    css: `
      radial-gradient(55% 45% at 14% 12%, rgba(251,146,60,0.52), transparent 62%),
      radial-gradient(52% 44% at 88% 18%, rgba(244,63,94,0.42), transparent 60%),
      radial-gradient(62% 58% at 82% 94%, rgba(180,60,30,0.55), transparent 64%),
      linear-gradient(160deg, #14100c, #0d0a0c 58%, #110c0d)
    `,
  },
  {
    id: "deep-space",
    label: "Deep Space",
    css: `
      radial-gradient(62% 52% at 50% 0%, rgba(56,189,248,0.40), transparent 58%),
      radial-gradient(54% 54% at 86% 82%, rgba(120,110,255,0.46), transparent 62%),
      radial-gradient(40% 40% at 8% 70%, rgba(45,212,191,0.26), transparent 60%),
      linear-gradient(180deg, #0c0c16, #08080f)
    `,
  },
];

export const DEFAULT_WALLPAPER_ID = "aurora-night";

export function getWallpaper(id: string | undefined): OsWallpaper {
  return OS_WALLPAPERS.find((w) => w.id === id) ?? OS_WALLPAPERS[0];
}
