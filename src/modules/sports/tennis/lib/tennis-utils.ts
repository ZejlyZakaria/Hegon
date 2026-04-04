import type { Surface, SurfaceConfig } from "../types";

// =====================================================
// TENNIS SURFACE CONFIGS (Pure constants)
// =====================================================

export const SURFACE_CONFIGS: Record<Surface, SurfaceConfig> = {
  clay: {
    label: "Clay",
    bg: "linear-gradient(135deg, #7c3a1e 0%, #a0522d 40%, #8b4513 100%)",
    accent: "#e8752a",
    textAccent: "#f4a460",
    lines: "rgba(255,220,150,0.25)",
  },
  hard: {
    label: "Hard",
    bg: "linear-gradient(135deg, #1a3a5c 0%, #1e4d8c 40%, #2563a8 100%)",
    accent: "#3b82f6",
    textAccent: "#93c5fd",
    lines: "rgba(147,197,253,0.25)",
  },
  grass: {
    label: "Grass",
    bg: "linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 100%)",
    accent: "#22c55e",
    textAccent: "#86efac",
    lines: "rgba(134,239,172,0.25)",
  },
  indoor: {
    label: "Indoor",
    bg: "linear-gradient(135deg, #312e81 0%, #3730a3 40%, #4338ca 100%)",
    accent: "#818cf8",
    textAccent: "#c7d2fe",
    lines: "rgba(199,210,254,0.25)",
  },
  unknown: {
    label: "Unknown surface",
    bg: "linear-gradient(135deg, #18181b 0%, #27272a 40%, #3f3f46 100%)",
    accent: "#71717a",
    textAccent: "#a1a1aa",
    lines: "rgba(161,161,170,0.2)",
  },
};

export function getSurface(tournamentName: string | null): Surface {
  if (!tournamentName) return "unknown";
  const name = tournamentName.toLowerCase();
  if (
    name.includes("roland") || name.includes("french") || name.includes("clay") ||
    name.includes("barcelona") || name.includes("madrid") || name.includes("rome") ||
    name.includes("monte") || name.includes("hamburg") || name.includes("rio") ||
    name.includes("munich") || name.includes("estoril") || name.includes("geneva")
  ) return "clay";
  if (
    name.includes("wimbledon") || name.includes("grass") || name.includes("halle") ||
    name.includes("queens") || name.includes("hertogenbosch") || name.includes("stuttgart")
  ) return "grass";
  if (
    name.includes("indoor") || name.includes("paris masters") || name.includes("nitto") ||
    name.includes("rotterdam") || name.includes("vienna") || name.includes("basel") ||
    name.includes("atp finals")
  ) return "indoor";
  return "hard";
}