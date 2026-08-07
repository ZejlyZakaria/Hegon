"use client";

import Image from "next/image";
import Link from "next/link";
import type { LiveStanding } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";

// The league table — shared by the Competition page and the main-page Standings section. Highlights
// the rows matching `highlightExtIds` (the user's favourite teams).
export default function StandingsTable({ rows, highlightExtIds }: { rows: LiveStanding[]; highlightExtIds?: Set<string> }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-text-tertiary">No standings available</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-caption text-text-tertiary">
            <th className="py-2 pl-2 text-left font-medium">#</th>
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
            return (
              <tr key={r.team_external_id} className={`border-t border-border-subtle ${mine ? "bg-accent-sports/5" : ""}`}>
                <td className="py-2 pl-2 tabular-nums text-text-tertiary">{r.position}</td>
                <td className="py-2">
                  <Link
                    href={`/perso/sports/football/team/${r.team_external_id}`}
                    className="flex items-center gap-2 transition-opacity hover:opacity-80"
                  >
                    <div className="relative h-5 w-5 shrink-0">
                      <Image src={r.team_crest || CREST_FALLBACK} alt={r.team_name} fill sizes="20px" className="object-contain" />
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
  );
}
