import {
  Star, Trophy, Award, Flame, Sparkles, Target, Heart,
  Film, Clapperboard, Tv, Popcorn, MonitorPlay,
  Rocket, Atom, Orbit, Satellite, Bot, Brain,
  Drama, VenetianMask, Feather,
  Fingerprint, Skull, Ghost, Search, Eye, Bomb, Crosshair, Swords,
  Wand2, Castle, Crown, Compass, Mountain,
  Laugh, Music, Camera, BookOpen, Globe,
} from "lucide-react";

type ListIcon = { key: string; icon: React.ElementType; color: string };

// Curated lucide icons for lists — genre-oriented (sci-fi, drama, crime/thriller,
// fantasy…), decoupled from the habits registry. Replaces the old emoji set.
export const LIST_ICONS: ListIcon[] = [
  // Favorites / ranking
  { key: "star",         icon: Star,         color: "#f59e0b" },
  { key: "trophy",       icon: Trophy,       color: "#f59e0b" },
  { key: "award",        icon: Award,        color: "#f59e0b" },
  { key: "flame",        icon: Flame,        color: "#f97316" },
  { key: "sparkles",     icon: Sparkles,     color: "#a855f7" },
  { key: "target",       icon: Target,       color: "#f43f5e" },
  { key: "heart",        icon: Heart,        color: "#f43f5e" },
  // Media
  { key: "film",         icon: Film,         color: "#2dd4bf" },
  { key: "clapperboard", icon: Clapperboard, color: "#2dd4bf" },
  { key: "tv",           icon: Tv,           color: "#2dd4bf" },
  { key: "popcorn",      icon: Popcorn,      color: "#2dd4bf" },
  { key: "monitor-play", icon: MonitorPlay,  color: "#2dd4bf" },
  // Sci-fi
  { key: "rocket",       icon: Rocket,       color: "#60a5fa" },
  { key: "atom",         icon: Atom,         color: "#22d3ee" },
  { key: "orbit",        icon: Orbit,        color: "#818cf8" },
  { key: "satellite",    icon: Satellite,    color: "#38bdf8" },
  { key: "bot",          icon: Bot,          color: "#94a3b8" },
  { key: "brain",        icon: Brain,        color: "#a855f7" },
  // Drama
  { key: "drama",        icon: Drama,        color: "#e879f9" },
  { key: "venetian-mask",icon: VenetianMask, color: "#c084fc" },
  { key: "feather",      icon: Feather,      color: "#a78bfa" },
  // Crime / thriller / horror
  { key: "fingerprint",  icon: Fingerprint,  color: "#f87171" },
  { key: "skull",        icon: Skull,        color: "#e5e7eb" },
  { key: "ghost",        icon: Ghost,        color: "#a5b4fc" },
  { key: "search",       icon: Search,       color: "#fbbf24" },
  { key: "eye",          icon: Eye,          color: "#f472b6" },
  { key: "bomb",         icon: Bomb,         color: "#ef4444" },
  { key: "crosshair",    icon: Crosshair,    color: "#ef4444" },
  { key: "swords",       icon: Swords,       color: "#fb923c" },
  // Fantasy / adventure
  { key: "wand",         icon: Wand2,        color: "#c084fc" },
  { key: "castle",       icon: Castle,       color: "#f59e0b" },
  { key: "crown",        icon: Crown,        color: "#facc15" },
  { key: "compass",      icon: Compass,      color: "#06b6d4" },
  { key: "mountain",     icon: Mountain,     color: "#34d399" },
  // Comedy / docu / music
  { key: "laugh",        icon: Laugh,        color: "#facc15" },
  { key: "music",        icon: Music,        color: "#ec4899" },
  { key: "camera",       icon: Camera,       color: "#ec4899" },
  { key: "book-open",    icon: BookOpen,     color: "#60a5fa" },
  { key: "globe",        icon: Globe,        color: "#06b6d4" },
];

const ICON_MAP = new Map(LIST_ICONS.map((i) => [i.key, i]));
export const LIST_ICON_KEYS = LIST_ICONS.map((i) => i.key);

// Renders a list's glyph: a lucide icon when the stored value is an icon key, or
// the raw string when it's a legacy emoji (backward-compat — no migration needed).
export function ListGlyph({
  value,
  size = 16,
  fallback = false,
  className,
}: {
  value: string | null | undefined;
  size?: number;
  /** Render a default icon when value is empty. */
  fallback?: boolean;
  className?: string;
}) {
  const found = value ? ICON_MAP.get(value) : undefined;
  if (found) {
    const Icon = found.icon;
    return <Icon size={size} className={className} style={{ color: found.color }} />;
  }
  if (value) return <span className={className}>{value}</span>; // legacy emoji
  if (fallback) return <Film size={size} className={className} />;
  return null;
}
