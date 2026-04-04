import type { TeamConfig } from "../types";

// =====================================================
// F1 UTILS (Pure functions)
// =====================================================

// ========== TEAM COLORS 2026 (11 équipes - hardcodé) ==========
export const TEAM_COLORS: Record<string, TeamConfig> = {
  red_bull: { 
    primary: '#0600EF', 
    secondary: '#FF0000', 
    name: 'Red Bull Racing' 
  },
  ferrari: { 
    primary: '#DC0000', 
    secondary: '#FFFFFF', 
    name: 'Ferrari' 
  },
  mercedes: { 
    primary: '#00D2BE', 
    secondary: '#000000', 
    name: 'Mercedes' 
  },
  mclaren: { 
    primary: '#FF8700', 
    secondary: '#47C7FC', 
    name: 'McLaren' 
  },
  aston_martin: { 
    primary: '#006F62', 
    secondary: '#CEDB00', 
    name: 'Aston Martin' 
  },
  alpine: { 
    primary: '#0090FF', 
    secondary: '#FF87BC', 
    name: 'Alpine' 
  },
  williams: { 
    primary: '#005AFF', 
    secondary: '#FFFFFF', 
    name: 'Williams' 
  },
  rb: { 
    primary: '#2B4562', 
    secondary: '#6692FF', 
    name: 'RB' 
  },
  // ✨ AUDI (nouveau 2026)
  audi: { 
    primary: '#000000', 
    secondary: '#FF1E00', 
    name: 'Audi Revolut F1 Team' 
  },
  haas: { 
    primary: '#B6BABD', 
    secondary: '#DC0000', 
    name: 'Haas' 
  },
  // ✨ CADILLAC (nouveau 2026)
  cadillac: { 
    primary: '#000000', 
    secondary: '#B8860B', 
    name: 'Cadillac F1 Team' 
  },
};

export const DEFAULT_TEAM_COLORS: TeamConfig = {
  primary: '#15151E',
  secondary: '#FFFFFF',
  name: 'Unknown Team'
};

export function getTeamConfig(jolpicaId: string): TeamConfig {
  return TEAM_COLORS[jolpicaId] || DEFAULT_TEAM_COLORS;
}

// ========== FORMATTERS ==========
export function formatRaceDateTime(date: string, time?: string): string {
  const d = new Date(date);
  const formatted = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  if (time) {
    return `${formatted} à ${time.slice(0, 5)}`;
  }
  return formatted;
}

export function getFlagUrl(countryCode: string): string {
  return `/assets/flags/${countryCode.toLowerCase()}.svg`;
}

export function getTeamLogoUrl(jolpicaId: string): string {
  return `/assets/f1/teams/${jolpicaId}.png`;
}

// Mapping Jolpica ID → nom de fichier SVG réel
const CIRCUIT_SVG_FILES: Record<string, string> = {
  'albert_park': 'melbourne-1.svg',
  'suzuka': 'suzuka-1.svg',
  'shanghai': 'shanghai-1.svg',
  'miami': 'miami-1.svg',
  'monaco': 'monaco-1.svg',
  'catalunya': 'catalunya-1.svg',
  'villeneuve': 'montreal-1.svg',
  'silverstone': 'silverstone-1.svg',
  'hungaroring': 'hungaroring-1.svg',
  'spa': 'spa-francorchamps-1.svg',
  'zandvoort': 'zandvoort-1.svg',
  'monza': 'monza-1.svg',
  'baku': 'baku-1.svg',
  'marina_bay': 'marina-bay-1.svg',
  'americas': 'austin-1.svg',
  'red_bull_ring': 'spielberg-1.svg',
  'rodriguez': 'mexico-city-1.svg',
  'interlagos': 'interlagos-1.svg',
  'vegas': 'las-vegas-1.svg',
  'yas_marina': 'yas-marina-1.svg',
};

export function getCircuitSvgUrl(jolpicaId: string): string | null {
  const filename = CIRCUIT_SVG_FILES[jolpicaId];
  return filename ? `/assets/f1/circuits/${filename}` : null;
}