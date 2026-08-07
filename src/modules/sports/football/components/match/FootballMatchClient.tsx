"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Tv, MapPin, Radio, Trash2, Star, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { useFootballMatch } from "../../hooks/useFootballMatch";
import {
  useFootballFanLog,
  useUpsertFootballFanLog,
  useDeleteFootballFanLog,
} from "../../hooks/useFootballFanLog";
import { useFootballPrediction, useUpsertFootballPrediction } from "../../hooks/useFootballPrediction";
import { getCrestsByExternalIds } from "../../service";
import type { WatchedWhere } from "../../types";

const ACCENT = "var(--color-accent-sports)"; // emerald #10b981

const WHERE: { key: WatchedWhere; label: string; icon: typeof Tv }[] = [
  { key: "tv", label: "TV", icon: Tv },
  { key: "stadium", label: "Stadium", icon: MapPin },
  { key: "live", label: "Live", icon: Radio },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Side({ name, crest, big, href, onNavigate }: { name: string; crest: string | null; big: boolean; href?: string; onNavigate?: () => void }) {
  const inner = (
    <>
      <div className="relative h-14 w-14 sm:h-20 sm:w-20">
        {crest ? (
          <Image src={crest} alt={name} fill sizes="80px" className="object-contain" unoptimized />
        ) : (
          <div className="h-full w-full rounded-full bg-surface-2" />
        )}
      </div>
      <p className={cn("text-xs sm:text-sm", big ? "font-semibold text-text-primary" : "text-text-secondary")}>{name}</p>
    </>
  );
  const cls = "flex flex-1 flex-col items-center gap-2 text-center";
  return href ? (
    <Link href={href} onClick={onNavigate} className={cn(cls, "transition-opacity hover:opacity-80")}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="flex h-7 w-7 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
        aria-label="Increase"
      >
        <ChevronUp size={16} />
      </button>
      <span className="w-9 text-center text-3xl font-bold tabular-nums text-text-primary">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
        aria-label="Decrease"
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}

export function FootballMatchClient({ externalId }: { externalId: number }) {
  const userId = useCurrentUserId();
  const closePanel = useMatchPanel((s) => s.close);

  const { data: match, isLoading } = useFootballMatch(externalId);
  const { data: fanLog } = useFootballFanLog(userId ?? "", externalId);
  const upsert = useUpsertFootballFanLog(userId ?? "", externalId);
  const remove = useDeleteFootballFanLog(userId ?? "", externalId);
  const { data: prediction } = useFootballPrediction(userId ?? "", externalId);
  const predict = useUpsertFootballPrediction(userId ?? "", externalId);

  const { data: crests = {} } = useQuery({
    queryKey: ["football", "crests", match?.home_team_external_id, match?.away_team_external_id],
    queryFn: () => getCrestsByExternalIds([match!.home_team_external_id, match!.away_team_external_id]),
    enabled: !!match,
  });

  // The Fan Log form — seeded from the stored row. Re-seeded when the row's IDENTITY changes (load,
  // delete, re-create) during render — the React-blessed way — so it never clobbers an edit in
  // progress and needs no effect.
  const [where, setWhere] = useState<WatchedWhere | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState("");
  const [seededId, setSeededId] = useState<string | null>(null);
  const currentId = fanLog?.id ?? null;
  if (currentId !== seededId) {
    setSeededId(currentId);
    setWhere(fanLog?.watched_where ?? null);
    setRating(fanLog?.rating ?? 0);
    setNote(fanLog?.note ?? "");
  }

  // Prediction form — same render-time seeding pattern.
  const [predHome, setPredHome] = useState<number>(0);
  const [predAway, setPredAway] = useState<number>(0);
  const [predSeededId, setPredSeededId] = useState<string | null>(null);
  const predId = prediction?.id ?? null;
  if (predId !== predSeededId) {
    setPredSeededId(predId);
    setPredHome(prediction?.pred_home ?? 0);
    setPredAway(prediction?.pred_away ?? 0);
  }

  if (isLoading || !match) {
    return (
      <div className="p-4">
        <div className="h-40 animate-pulse rounded-card bg-surface-2" />
        <div className="mt-4 h-56 animate-pulse rounded-card bg-surface-2" />
      </div>
    );
  }

  const isFinished = match.status === "FINISHED";
  // You can only have WATCHED a match that has kicked off. A future match gets a placeholder
  // (predictions land in phase 1c — the real "avant le coup d'envoi" action).
  const started = ["IN_PLAY", "PAUSED", "FINISHED"].includes(match.status);
  const homeWon = match.winner === "HOME_TEAM";
  const awayWon = match.winner === "AWAY_TEAM";
  const logged = !!fanLog;

  // How your prediction fared, once the match is over. Exact score > right result > missed.
  const predOutcome: "exact" | "result" | "miss" | null = (() => {
    if (!prediction || !isFinished || match.home_score == null || match.away_score == null) return null;
    if (prediction.pred_home === match.home_score && prediction.pred_away === match.away_score) return "exact";
    const s = (a: number, b: number) => Math.sign(a - b);
    return s(prediction.pred_home, prediction.pred_away) === s(match.home_score, match.away_score) ? "result" : "miss";
  })();

  const save = () =>
    upsert.mutate({
      external_match_id: externalId,
      watched_where: where,
      rating: rating > 0 ? rating : null,
      note: note.trim() || null,
    });

  return (
    <div className="p-4">
      {/* ── Hero — score + contexte ── */}
      <div className="surface-card rounded-card p-5">
        <div className="mb-4 flex items-center justify-center gap-2 text-center">
          <span className="text-micro font-semibold uppercase tracking-widest text-text-tertiary">
            {match.stage && match.stage !== "REGULAR_SEASON"
              ? match.stage.replace(/_/g, " ")
              : match.matchday
                ? `Matchday ${match.matchday}`
                : "Match"}
          </span>
          {logged && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Side name={match.home_team_name} crest={crests[match.home_team_external_id] ?? null} big={homeWon} href={`/perso/sports/football/team/${match.home_team_external_id}`} onNavigate={closePanel} />

          <div className="flex shrink-0 flex-col items-center px-2">
            {isFinished ? (
              <>
                <div className="flex items-center gap-2 text-3xl font-bold tabular-nums sm:text-4xl">
                  <span className={homeWon ? "text-text-primary" : "text-text-secondary"}>{match.home_score}</span>
                  <span className="text-text-tertiary">–</span>
                  <span className={awayWon ? "text-text-primary" : "text-text-secondary"}>{match.away_score}</span>
                </div>
                {match.home_score_ht != null && match.away_score_ht != null && (
                  <span className="mt-1 text-micro text-text-tertiary">
                    half-time {match.home_score_ht}–{match.away_score_ht}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-2xl font-bold tabular-nums text-text-primary">{fmtTime(match.utc_date)}</span>
                <span className="mt-1 text-micro uppercase tracking-wide text-text-tertiary">upcoming</span>
              </>
            )}
          </div>

          <Side name={match.away_team_name} crest={crests[match.away_team_external_id] ?? null} big={awayWon} href={`/perso/sports/football/team/${match.away_team_external_id}`} onNavigate={closePanel} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-micro text-text-tertiary">
          <span>{fmtDate(match.utc_date)}</span>
          {match.venue && (<><span className="text-white/15">·</span><span>{match.venue}</span></>)}
          {match.attendance && (<><span className="text-white/15">·</span><span>{match.attendance.toLocaleString("en-GB")} in attendance</span></>)}
        </div>
      </div>

      {/* ── Mon avis (Fan Log) ── */}
      <div className="surface-card mt-4 rounded-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">My take</h2>

        {!started ? (
          <>
            <p className="mb-4 text-center text-micro uppercase tracking-wide text-text-tertiary">Predict the score</p>
            <div className="flex items-center justify-center gap-5">
              <Stepper value={predHome} onChange={setPredHome} />
              <span className="text-xl font-bold text-text-tertiary">–</span>
              <Stepper value={predAway} onChange={setPredAway} />
            </div>
            <button
              type="button"
              onClick={() => predict.mutate({ home: predHome, away: predAway })}
              disabled={predict.isPending}
              className="mt-5 w-full rounded-control py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {prediction ? "Update prediction" : "Predict"}
            </button>
          </>
        ) : (
        <>
        {predOutcome && (
          <div className={cn(
            "mb-4 flex items-center justify-center gap-1.5 rounded-control border py-2 text-xs font-medium",
            predOutcome === "exact" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : predOutcome === "result" ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-border-subtle text-text-tertiary",
          )}>
            Your prediction {prediction!.pred_home}–{prediction!.pred_away} ·{" "}
            {predOutcome === "exact" ? "Exact score" : predOutcome === "result" ? "Right result" : "Missed"}
          </div>
        )}
        {/* Où */}
        <p className="mb-1.5 text-micro uppercase tracking-wide text-text-tertiary">Where did you watch it?</p>
        <div className="flex gap-2">
          {WHERE.map(({ key, label, icon: Icon }) => {
            const on = where === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setWhere(on ? null : key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-control border py-2 text-xs font-medium transition-colors",
                  on ? "text-white" : "border-border-subtle text-text-secondary hover:bg-surface-2",
                )}
                style={on ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
              >
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>

        {/* Note */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-micro uppercase tracking-wide text-text-tertiary">Your rating</p>
            <span className="flex items-center gap-1 text-sm font-bold tabular-nums" style={{ color: ACCENT }}>
              <Star size={12} style={{ color: ACCENT, fill: ACCENT }} /> {rating > 0 ? rating.toFixed(1) : "—"}
            </span>
          </div>
          <input
            type="range" min={0} max={10} step={0.5}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Mot */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="A word on this match…"
          rows={3}
          className="mt-4 w-full resize-none rounded-control border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
        />

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={upsert.isPending}
            className="flex-1 rounded-control py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {logged ? "Update" : "I watched this match"}
          </button>
          {logged && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="flex h-10 w-10 items-center justify-center rounded-control border border-border-subtle text-text-tertiary transition-colors hover:border-red-400/40 hover:text-red-400"
              aria-label="Remove"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
