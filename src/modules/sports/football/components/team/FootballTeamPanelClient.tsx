"use client";

// The Team Panel body — opened from a Following-strip card. Composes existing reads (no new API):
//   · YOUR record for the team (football_watched_matches) · next match · recent form.
// The Unfollow control lives here (the strip is a launcher, not an editor) — a two-step inline
// confirm, no separate modal.

import { useState } from "react";
import Image from "next/image";
import { Star, MapPin, Clock, Trash2, Loader2 } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useUpcomingMatches, useRecentMatches } from "../../hooks/useFootballMatches";
import { useTeamPersonalStats } from "../../hooks/useTeamPersonalStats";
import { useUnfollowTeam } from "../../hooks/useFootballTeams";
import type { TeamPanelTeam } from "../../hooks/useTeamPanelStore";
import type { FootballMatchLite } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";

export function FootballTeamPanelClient({
  team,
  onUnfollowed,
}: {
  team: TeamPanelTeam;
  onUnfollowed: () => void;
}) {
  const userId = useCurrentUserId();
  const ext = team.api_external_id;

  const { data: stats } = useTeamPersonalStats(userId, ext);
  const { data: upcoming } = useUpcomingMatches(ext ? [ext] : []);
  const { data: recent } = useRecentMatches(ext ? [ext] : []);
  const unfollow = useUnfollowTeam(userId);

  const [confirming, setConfirming] = useState(false);

  const nextMatch = upcoming?.[0] ?? null;
  const recentFive = (recent ?? []).slice(0, 5);

  const handleUnfollow = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    unfollow.mutate(team.id, { onSuccess: onUnfollowed });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Hero */}
      <div className="flex flex-col items-center gap-2 pb-1 pt-2">
        <div className="relative h-16 w-16">
          <Image src={team.crest_url || CREST_FALLBACK} alt={team.name} fill sizes="64px" className="object-contain drop-shadow" />
        </div>
        <div className="flex items-center gap-1.5">
          {team.isMain && <Star size={13} className="fill-accent-sports text-accent-sports" />}
          <h3 className="text-title text-text-primary">{team.name}</h3>
        </div>
        {team.isMain && (
          <span className="text-caption text-accent-sports">Main team</span>
        )}
      </div>

      {/* Your record */}
      <Block label="Your record">
        <div className="grid grid-cols-3 gap-2">
          <Stat value={stats?.watchedCount ?? 0} label="Watched" />
          <Stat value={stats?.stadiumCount ?? 0} label="At stadium" />
          <Stat value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : "—"} label="Avg rating" />
        </div>
      </Block>

      {/* Next match */}
      <Block label="Next match">
        {nextMatch ? (
          <MatchRow m={nextMatch} teamExt={ext} />
        ) : (
          <Empty>No upcoming match</Empty>
        )}
      </Block>

      {/* Recent form */}
      <Block label="Recent form">
        {recentFive.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              {recentFive.map((m) => {
                const r = resultFor(m, ext);
                return <FormDot key={m.external_match_id} result={r} />;
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              {recentFive.map((m) => (
                <MatchRow key={m.external_match_id} m={m} teamExt={ext} compact />
              ))}
            </div>
          </div>
        ) : (
          <Empty>No recent results</Empty>
        )}
      </Block>

      {/* Unfollow */}
      <button
        onClick={handleUnfollow}
        disabled={unfollow.isPending}
        className={`mt-1 flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-semibold transition-colors ${
          confirming
            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
            : "text-text-tertiary hover:bg-white/5 hover:text-red-400"
        }`}
      >
        {unfollow.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        {confirming ? "Confirm unfollow" : "Unfollow"}
      </button>
    </div>
  );
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-surface-2 p-4">
      <p className="text-caption mb-3 text-text-tertiary">{label}</p>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xl font-bold text-accent-sports">{value}</span>
      <span className="text-[10px] text-text-tertiary">{label}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-tertiary">{children}</p>;
}

// ─── Match row ──────────────────────────────────────────────────────────────

function MatchRow({ m, teamExt, compact }: { m: FootballMatchLite; teamExt: string | null; compact?: boolean }) {
  const isHome = teamExt != null && m.home_external_id === teamExt;
  const oppName = isHome ? m.away_name : m.home_name;
  const oppCrest = isHome ? m.away_crest : m.home_crest;
  const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-6 w-6 shrink-0">
        <Image src={oppCrest || CREST_FALLBACK} alt={oppName} fill sizes="24px" className="object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{oppName}</p>
        {!compact && (
          <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <MapPin size={11} />
            {isHome ? "Home" : "Away"}
            {m.competition_name && <span className="text-text-tertiary/60">· {m.competition_name}</span>}
          </p>
        )}
      </div>
      {finished ? (
        <span className="shrink-0 text-sm font-bold tabular-nums text-text-primary">
          {m.home_score}–{m.away_score}
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-sports">
          <Clock size={11} />
          {countdown(m.utc_date)}
        </span>
      )}
    </div>
  );
}

function FormDot({ result }: { result: "W" | "D" | "L" | null }) {
  const map = {
    W: { bg: "bg-accent-sports text-black", label: "W" },
    D: { bg: "bg-zinc-600 text-white", label: "D" },
    L: { bg: "bg-red-500 text-white", label: "L" },
  } as const;
  const s = result ? map[result] : { bg: "bg-surface-3 text-text-tertiary", label: "–" };
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${s.bg}`}>
      {s.label}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resultFor(m: FootballMatchLite, teamExt: string | null): "W" | "D" | "L" | null {
  if (teamExt == null || m.home_score == null || m.away_score == null) return null;
  const isHome = m.home_external_id === teamExt;
  const gf = isHome ? m.home_score : m.away_score;
  const ga = isHome ? m.away_score : m.home_score;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Live";
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `D-${days}`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(diff / 60_000))}m`;
}
