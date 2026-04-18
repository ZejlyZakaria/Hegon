import {
  // Fitness & Movement
  Dumbbell, Footprints, Bike, PersonStanding, HeartPulse, Swords,
  // Health & Body
  Heart, Activity, Droplets, Pill, Apple, Wind, Salad,
  // Mind & Learning
  Brain, BookOpen, BookMarked, GraduationCap, Lightbulb, Pencil, Code2, Languages, Globe,
  // Sleep & Recovery
  Moon, Bed, BatteryCharging,
  // Energy & Motivation
  Flame, Zap, Sparkles, Sun, Sunrise,
  // Productivity & Focus
  Target, Clock, Timer, ListTodo, Focus, CheckSquare,
  // Growth & Progress
  TrendingUp, BarChart2, Compass, Shield, Award,
  // Work & Finance
  Briefcase, DollarSign, PiggyBank, Wallet,
  // Life & Social
  Home, Users, Smile, Star, Music, Headphones, Camera, Leaf,
  // Mindfulness & Spiritual
  CloudSun, TreePine, Coffee,
} from "lucide-react"

export interface IconConfig {
  key:   string
  icon:  React.ElementType
  label: string
  color: string
  tags:  string[]
}

export const ICONS: IconConfig[] = [
  // ── Fitness & Movement ──────────────────────────────────────────────────────
  { key: "dumbbell",       icon: Dumbbell,       label: "Dumbbell",    color: "#f43f5e", tags: ["fitness", "gym", "workout", "strength", "lift"]    },
  { key: "footprints",     icon: Footprints,     label: "Running",     color: "#f97316", tags: ["run", "walk", "steps", "cardio", "jog"]            },
  { key: "bike",           icon: Bike,           label: "Cycling",     color: "#f97316", tags: ["bike", "cycle", "cardio", "sport"]                 },
  { key: "person-standing",icon: PersonStanding, label: "Stretch",     color: "#f43f5e", tags: ["stretch", "yoga", "flexibility", "pose"]           },
  { key: "heart-pulse",    icon: HeartPulse,     label: "Cardio",      color: "#f43f5e", tags: ["cardio", "heart", "health", "pulse", "beat"]       },
  { key: "swords",         icon: Swords,         label: "Sport",       color: "#f97316", tags: ["sport", "martial", "fight", "compete"]             },

  // ── Health & Body ───────────────────────────────────────────────────────────
  { key: "heart",          icon: Heart,          label: "Health",      color: "#f43f5e", tags: ["love", "health", "care", "well"]                   },
  { key: "activity",       icon: Activity,       label: "Activity",    color: "#10b981", tags: ["fitness", "health", "pulse", "active", "track"]    },
  { key: "droplets",       icon: Droplets,       label: "Water",       color: "#06b6d4", tags: ["water", "hydration", "drink", "fluid"]             },
  { key: "pill",           icon: Pill,           label: "Medication",  color: "#60a5fa", tags: ["medicine", "pill", "supplement", "vitamin"]        },
  { key: "apple",          icon: Apple,          label: "Nutrition",   color: "#10b981", tags: ["food", "eat", "diet", "nutrition", "health"]       },
  { key: "salad",          icon: Salad,          label: "Healthy Food",color: "#22c55e", tags: ["salad", "vegetable", "diet", "greens"]             },
  { key: "wind",           icon: Wind,           label: "Breathing",   color: "#06b6d4", tags: ["breathe", "meditation", "calm", "air", "pranayama"]},

  // ── Mind & Learning ─────────────────────────────────────────────────────────
  { key: "brain",          icon: Brain,          label: "Brain",       color: "#a855f7", tags: ["mind", "think", "focus", "mental", "cognitive"]    },
  { key: "book-open",      icon: BookOpen,       label: "Reading",     color: "#60a5fa", tags: ["book", "read", "learn", "study", "literature"]     },
  { key: "book-marked",    icon: BookMarked,     label: "Notes",       color: "#8b5cf6", tags: ["journal", "diary", "write", "notes", "log"]        },
  { key: "graduation-cap", icon: GraduationCap,  label: "Learning",    color: "#60a5fa", tags: ["learn", "study", "education", "school", "course"]  },
  { key: "lightbulb",      icon: Lightbulb,      label: "Ideas",       color: "#f59e0b", tags: ["idea", "think", "creative", "insight", "innovate"] },
  { key: "pencil",         icon: Pencil,         label: "Writing",     color: "#f59e0b", tags: ["write", "journal", "notes", "creative", "essay"]   },
  { key: "code-2",         icon: Code2,          label: "Coding",      color: "#a855f7", tags: ["code", "programming", "dev", "tech", "build"]      },
  { key: "languages",      icon: Languages,      label: "Languages",   color: "#06b6d4", tags: ["language", "learn", "speak", "foreign", "vocab"]   },
  { key: "globe",          icon: Globe,          label: "World",       color: "#06b6d4", tags: ["language", "travel", "explore", "global"]          },

  // ── Sleep & Recovery ────────────────────────────────────────────────────────
  { key: "moon",           icon: Moon,           label: "Sleep",       color: "#8b5cf6", tags: ["sleep", "rest", "night", "relax", "recovery"]      },
  { key: "bed",            icon: Bed,            label: "Rest",        color: "#8b5cf6", tags: ["sleep", "bed", "rest", "recover", "nap"]           },
  { key: "battery-charging",icon: BatteryCharging,label: "Recharge",   color: "#10b981", tags: ["recharge", "energy", "recovery", "restore"]        },

  // ── Energy & Motivation ─────────────────────────────────────────────────────
  { key: "flame",          icon: Flame,          label: "Streak",      color: "#f97316", tags: ["fire", "streak", "motivation", "energy", "hot"]    },
  { key: "zap",            icon: Zap,            label: "Energy",      color: "#f59e0b", tags: ["energy", "power", "fast", "motivation", "boost"]   },
  { key: "sparkles",       icon: Sparkles,       label: "Mindfulness", color: "#a855f7", tags: ["mindfulness", "meditation", "spiritual", "calm"]   },
  { key: "sun",            icon: Sun,            label: "Morning",     color: "#f59e0b", tags: ["morning", "wake", "sunshine", "routine", "rise"]   },
  { key: "sunrise",        icon: Sunrise,        label: "Sunrise",     color: "#f97316", tags: ["morning", "routine", "start", "dawn", "early"]     },

  // ── Productivity & Focus ────────────────────────────────────────────────────
  { key: "target",         icon: Target,         label: "Goal",        color: "#f43f5e", tags: ["goal", "target", "focus", "achievement", "aim"]    },
  { key: "clock",          icon: Clock,          label: "Time",        color: "#71717a", tags: ["time", "schedule", "routine", "clock", "punctual"] },
  { key: "timer",          icon: Timer,          label: "Focus Timer", color: "#60a5fa", tags: ["timer", "focus", "pomodoro", "time", "deep work"]  },
  { key: "list-todo",      icon: ListTodo,       label: "To-do",       color: "#71717a", tags: ["todo", "task", "checklist", "productivity", "plan"]},
  { key: "focus",          icon: Focus,          label: "Focus",       color: "#60a5fa", tags: ["focus", "concentrate", "deep", "work", "attention"]},
  { key: "check-square",   icon: CheckSquare,    label: "Done",        color: "#10b981", tags: ["done", "complete", "check", "habit", "task"]       },

  // ── Growth & Progress ───────────────────────────────────────────────────────
  { key: "trending-up",    icon: TrendingUp,     label: "Progress",    color: "#10b981", tags: ["progress", "growth", "improve", "trend", "up"]     },
  { key: "bar-chart-2",    icon: BarChart2,      label: "Stats",       color: "#10b981", tags: ["stats", "data", "track", "measure", "analyze"]     },
  { key: "compass",        icon: Compass,        label: "Direction",   color: "#06b6d4", tags: ["goal", "direction", "guide", "explore", "path"]    },
  { key: "shield",         icon: Shield,         label: "Discipline",  color: "#60a5fa", tags: ["discipline", "protect", "strength", "commit", "will"]},
  { key: "award",          icon: Award,          label: "Achievement", color: "#f59e0b", tags: ["award", "win", "goal", "achievement", "medal"]     },

  // ── Work & Finance ──────────────────────────────────────────────────────────
  { key: "briefcase",      icon: Briefcase,      label: "Work",        color: "#71717a", tags: ["work", "job", "professional", "career", "office"]  },
  { key: "dollar-sign",    icon: DollarSign,     label: "Finance",     color: "#10b981", tags: ["money", "finance", "budget", "save", "earn"]       },
  { key: "piggy-bank",     icon: PiggyBank,      label: "Savings",     color: "#10b981", tags: ["save", "money", "finance", "budget", "invest"]     },
  { key: "wallet",         icon: Wallet,         label: "Budget",      color: "#f59e0b", tags: ["wallet", "budget", "money", "spend", "track"]      },

  // ── Life & Hobbies ──────────────────────────────────────────────────────────
  { key: "home",           icon: Home,           label: "Home",        color: "#10b981", tags: ["home", "family", "clean", "organize", "domestic"]  },
  { key: "users",          icon: Users,          label: "Social",      color: "#60a5fa", tags: ["social", "people", "connect", "relationship", "family"]},
  { key: "smile",          icon: Smile,          label: "Happiness",   color: "#f59e0b", tags: ["happy", "mood", "gratitude", "positive", "joy"]    },
  { key: "star",           icon: Star,           label: "Star",        color: "#f59e0b", tags: ["star", "goal", "achievement", "great", "daily"]    },
  { key: "music",          icon: Music,          label: "Music",       color: "#ec4899", tags: ["music", "listen", "practice", "instrument", "sing"]},
  { key: "headphones",     icon: Headphones,     label: "Podcast",     color: "#8b5cf6", tags: ["podcast", "music", "listen", "audio", "learn"]     },
  { key: "camera",         icon: Camera,         label: "Photography", color: "#ec4899", tags: ["photo", "picture", "creative", "art", "capture"]   },
  { key: "leaf",           icon: Leaf,           label: "Nature",      color: "#22c55e", tags: ["nature", "green", "plant", "eco", "outside"]       },

  // ── Mindfulness ─────────────────────────────────────────────────────────────
  { key: "cloud-sun",      icon: CloudSun,       label: "Gratitude",   color: "#f59e0b", tags: ["gratitude", "mindful", "calm", "positive", "reflect"]},
  { key: "tree-pine",      icon: TreePine,       label: "Walk Outside",color: "#22c55e", tags: ["nature", "walk", "outside", "forest", "fresh air"] },
  { key: "coffee",         icon: Coffee,         label: "Coffee",      color: "#f97316", tags: ["coffee", "morning", "drink", "caffeine", "ritual"] },
]

// 8 icons shown by default (no search)
export const DEFAULT_ICONS: string[] = [
  "star", "dumbbell", "book-open", "brain",
  "moon", "droplets", "flame", "heart",
]

export type IconKey = typeof ICONS[number]["key"]

/** Resolve icon component + color from a key. Falls back to Dumbbell/rose. */
export function resolveIcon(key: string | null | undefined): IconConfig {
  return ICONS.find((i) => i.key === key) ?? ICONS.find((i) => i.key === "star")!
}
