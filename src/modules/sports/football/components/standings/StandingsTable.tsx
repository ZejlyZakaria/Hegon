"use client";

import Image from "next/image";
import Link from "next/link";
import type { StandingRow } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";

// ─── Qualification / relegation zones, per competition ────────────────────────────
// Counts from the TOP (ucl, then europa) and from the BOTTOM (relegation). Only European domestic
// leagues are configured; cups, the Champions League itself and national-team tournaments get none.
// Approximate current-season values — tweak here if a coefficient changes; the UI reads this map.
type Zone = "ucl" | "europa" | "relegation";
type ZoneConfig = { ucl: number; europa: number; relegation: number };

const ZONES: Record<string, ZoneConfig> = {
  PD: { ucl: 5, europa: 2, relegation: 3 },   // La Liga
  PL: { ucl: 5, europa: 1, relegation: 3 },   // Premier League
  SA: { ucl: 5, europa: 2, relegation: 3 },   // Serie A
  BL1: { ucl: 4, europa: 2, relegation: 3 },  // Bundesliga
  FL1: { ucl: 3, europa: 2, relegation: 2 },  // Ligue 1
  DED: { ucl: 2, europa: 2, relegation: 2 },  // Eredivisie
  PPL: { ucl: 2, europa: 2, relegation: 2 },  // Primeira Liga
};

const ZONE_BAR: Record<Zone, string> = {
  ucl: "bg-blue-500",
  europa: "bg-orange-500",
  relegation: "bg-red-500",
};
const ZONE_LABEL: Record<Zone, string> = {
  ucl: "Champions League",
  europa: "Europa League",
  relegation: "Relegation",
};

function zoneFor(position: number, total: number, cfg: ZoneConfig | undefined): Zone | null {
  if (!cfg) return null;
  if (position <= cfg.ucl) return "ucl";
  if (position <= cfg.ucl + cfg.europa) return "europa";
  if (position > total - cfg.relegation) return "relegation";
  return null;
}

// The league table — shared by the Competition page and the main-page Standings section. Highlights
// the user's favourite teams, colours the qualification/relegation zones, and scrolls (~10 rows shown)
// with a sticky header for the long ones.
export default function StandingsTable({
  rows,
  highlightExtIds,
  competitionCode,
}: {
  rows: StandingRow[];
  highlightExtIds?: Set<string>;
  competitionCode?: string | null;
}) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-text-tertiary">No standings available</p>;

  const cfg = competitionCode ? ZONES[competitionCode] : undefined;
  const total = rows.length;
  const zonesPresent: Zone[] = cfg ? (["ucl", "europa", "relegation"] as Zone[]) : [];

  return (
    <div>
      <div className="max-h-104 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-1">
            <tr className="text-caption text-text-tertiary">
              <th className="py-2 pl-3 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">Team</th>
              <th className="py-2 text-center font-medium">P</th>
              <th className="hidden py-2 text-center font-medium sm:table-cell">W</th>
              <th className="hidden py-2 text-center font-medium sm:table-cell">D</th>
              <th className="hidden py-2 text-center font-medium sm:table-cell">L</th>
              <th className="py-2 text-center font-medium">GD</th>
              <th className="py-2 pr-2 text-center font-semibold text-text-secondary">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mine = highlightExtIds?.has(r.team_external_id);
              const zone = zoneFor(r.position, total, cfg);
              return (
                <tr key={r.team_external_id} className={`border-t border-border-subtle ${mine ? "bg-accent-sports/5" : ""}`}>
                  <td className="py-2 pl-3">
                    <span className="flex items-center gap-2">
                      <span className={`h-4 w-0.5 shrink-0 rounded-full ${zone ? ZONE_BAR[zone] : "bg-transparent"}`} />
                      <span className="tabular-nums text-text-tertiary">{r.position}</span>
                    </span>
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/perso/sports/football/team/${r.team_external_id}`}
                      className="flex items-center gap-2 transition-opacity hover:opacity-80"
                    >
                      <div className="relative h-5 w-5 shrink-0">
                        <Image src={r.team_crest || CREST_FALLBACK} alt={r.team_name ?? ""} fill sizes="20px" className="object-contain" />
                      </div>
                      <span className={`truncate ${mine ? "font-semibold text-accent-sports" : "text-text-primary"}`}>{r.team_name}</span>
                    </Link>
                  </td>
                  <td className="py-2 text-center tabular-nums text-text-secondary">{r.played}</td>
                  <td className="hidden py-2 text-center tabular-nums text-text-tertiary sm:table-cell">{r.won}</td>
                  <td className="hidden py-2 text-center tabular-nums text-text-tertiary sm:table-cell">{r.draw}</td>
                  <td className="hidden py-2 text-center tabular-nums text-text-tertiary sm:table-cell">{r.lost}</td>
                  <td className="py-2 text-center tabular-nums text-text-secondary">{r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}</td>
                  <td className="py-2 pr-2 text-center font-bold tabular-nums text-text-primary">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Zone legend */}
      {zonesPresent.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-subtle pt-3">
          {zonesPresent.map((z) => (
            <span key={z} className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
              <span className={`h-2 w-2 shrink-0 rounded-full ${ZONE_BAR[z]}`} />
              {ZONE_LABEL[z]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
