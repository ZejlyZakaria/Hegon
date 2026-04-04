// /lib/constants/sidebar-colors.ts

// =====================================================
// TASKS SIDEBAR - Glass neutre (pour double sidebar)
// =====================================================

export const TASKS_SIDEBAR_GLASS = {
  // Glass effect
  background: "bg-zinc-900/40",
  backdropBlur: "backdrop-blur-xl",
  border: "border-white/[0.08]",
  
  // Gradients
  gradientTop: "from-white/[0.03]",
  gradientBottom: "to-transparent",
  
  // Top shine line
  topShine: "via-white/10",
  
  // Hover states
  hover: "hover:bg-white/[0.04]",
  active: "bg-white/[0.08]",
  borderHover: "border-white/[0.05]",
  
  // Text colors
  textPrimary: "text-zinc-100",
  textSecondary: "text-zinc-400",
  textMuted: "text-zinc-600",
} as const;

// =====================================================
// SECTION ACCENTS (utilisé pour items actifs, etc.)
// =====================================================

export const SECTION_ACCENTS = {
  "/perso/sports": "#10b981",
  "/perso/watching": "#8b5cf6",
  "/perso/books": "#f97316",
  "/perso/travel": "#0ea5e9",
  "/perso/fitness": "#f43f5e",
  "/pro/tasks": "#6366f1",
  "/pro/goals": "#22c55e",
  "/pro/jobhunt": "#3b82f6",
  "/pro/tech": "#a855f7",
} as const;

// Helper pour récupérer l'accent selon pathname
export const getSectionAccent = (pathname: string): string => {
  for (const [path, accent] of Object.entries(SECTION_ACCENTS)) {
    if (pathname.startsWith(path)) return accent;
  }
  return "#6366f1"; // Default indigo
};