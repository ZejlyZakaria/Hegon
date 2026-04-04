// =====================================================
// FOOTBALL UTILS (Pure functions)
// =====================================================

const COMPETITION_DISPLAY: Record<string, string> = {
  "Primera Division": "La Liga",
  "UEFA Champions League": "Champions League",
  "Premier League": "Premier League",
};

export function displayCompetition(name: string | null): string {
  if (!name) return "";
  return COMPETITION_DISPLAY[name] ?? name;
}

export function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getCountdown(dateStr: string): string {
  const now = new Date();
  const matchDate = new Date(dateStr);
  const diff = matchDate.getTime() - now.getTime();
  
  if (diff < 0) return "Match terminé";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `Dans ${days}j ${hours}h`;
  if (hours > 0) return `Dans ${hours}h`;
  return "Aujourd'hui";
}