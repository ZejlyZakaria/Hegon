// Shared achievement contract — one shape across every HEGON module.
// Modules compute their own achievements (their business logic) and return this
// shape; the shared <AchievementGrid> renders them identically everywhere.

export type AchievementIcon =
  // streaks / general
  | "flame"
  | "medal"
  | "trophy"
  | "gem"
  | "calendarCheck"
  | "calendarRange"
  | "layers"
  | "rotateCcw"
  // watching
  | "clapperboard"
  | "tv"
  | "star"
  | "drama"
  | "globe"
  | "sparkles";

export interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: AchievementIcon;
  unlocked: boolean;
  progress: number; // 0..1
  progressLabel: string;
  /** Optional per-badge color (CSS). Falls back to the module accent. */
  color?: string;
}
