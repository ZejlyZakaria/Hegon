"use client";

import { Check, CircleSlash, Clock, PauseCircle, Play } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { seriesState } from "../../lib/series-state";

/**
 * "HOW FAR DID YOU GET?" — the one question the add flow never asked.
 *
 * It used to ask WHICH LIST, and wrote the status from the answer:
 *     watched: listContext === "recentlyWatched" || "topTen" || "library"
 * A list is not a fact, it's a CONSEQUENCE. For a film the two coincide (seen it / haven't). For
 * a series they don't — and that line put 23 rows in the database claiming you'd finished shows
 * that are still running.
 *
 * ── AND THEN A SECOND QUESTION, BECAUSE `in_progress` HAS THE SAME DISEASE ──────────────────
 * "In Progress" means "series you are CURRENTLY WATCHING". You watched three seasons of Seven
 * Deadly Sins years ago and stopped: that is not "in progress", it's over — for now, or for good.
 * `in_progress` conflates "I'm watching this" with "I stopped partway", exactly as `watched`
 * conflated "caught up" with "finished". The app already owns the right words — `paused` and
 * `dropped` — it simply never asked. So we ask.
 *
 * The season strip is deliberately the SAME instrument as Watch History: adding a title and
 * correcting it later are the same gesture, learned once. Seasons that haven't aired are not
 * choices — you cannot have watched them.
 */
export interface Position {
  season: number;
  episode: number;
}

/** What happened after you stopped. Only asked when you stopped PARTWAY — see above. */
export type Stance = "watching" | "paused" | "dropped";

interface Props {
  /** Episodes ACTUALLY AIRED per season (from TMDB's last_episode_to_air — free, exact). */
  seasonAired: number[];
  status: string | null;
  value: Position | null;
  onChange: (p: Position | null) => void;
  stance: Stance;
  onStanceChange: (s: Stance) => void;
}

const STANCES: { key: Stance; label: string; icon: React.ReactNode }[] = [
  { key: "watching", label: "Still watching", icon: <Play size={12} /> },
  { key: "paused", label: "Paused", icon: <PauseCircle size={12} /> },
  { key: "dropped", label: "Not continuing", icon: <CircleSlash size={12} /> },
];

export function HowFarDidYouGet({
  seasonAired,
  status,
  value,
  onChange,
  stance,
  onStanceChange,
}: Props) {
  const airedSeasons = seasonAired
    .map((n, i) => ({ season: i + 1, aired: n }))
    .filter((s) => s.aired > 0);

  if (airedSeasons.length === 0) return null;

  const last = airedSeasons[airedSeasons.length - 1];
  const isAll = value?.season === last.season && value?.episode === last.aired;
  const isPartial = !!value && !isAll;

  // What "all of it" MEANS depends on the world, not on you: a finished show you've seen through
  // is watched; an ongoing one is caught up. The distinction the old model could not make.
  const allState = seriesState({
    season_aired: seasonAired,
    status,
    current_season: last.season,
    current_episode: last.aired,
  });
  const allIsFinish = allState === "completed";

  const chip = (selected: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors",
      selected
        ? "bg-accent-watching-vivid text-surface-0"
        : "bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary",
    );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-caption uppercase text-text-tertiary">How far did you get?</label>
        <div className="flex flex-wrap gap-1.5">
          {airedSeasons.map(({ season, aired }) => (
            <button
              key={season}
              type="button"
              onClick={() => onChange({ season, episode: aired })}
              className={chip(!isAll && value?.season === season)}
            >
              Through S{season}
            </button>
          ))}

          <button
            type="button"
            onClick={() => onChange({ season: last.season, episode: last.aired })}
            className={chip(isAll)}
          >
            {allIsFinish ? <Check size={12} /> : <Clock size={12} />}
            {allIsFinish ? "All of it" : "Everything that's out"}
          </button>
        </div>
      </div>

      {/* THE SECOND QUESTION. You stopped at season 3 — but did you stop, or are you still going?
          "In Progress" is a rail for what you're watching NOW; a show you left behind in 2018 has
          no business there. The app owns `paused` and `dropped`; it just never asked. */}
      {isPartial && (
        <div className="space-y-2">
          <label className="block text-caption uppercase text-text-tertiary">And now?</label>
          <div className="flex flex-wrap gap-1.5">
            {STANCES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onStanceChange(s.key)}
                className={chip(stance === s.key)}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What the app will actually record — said out loud, before you commit to it. The word
          "watched" is absent on an ongoing show because it isn't true, not because it's hidden. */}
      {value && (
        <p className="text-micro text-text-tertiary">
          {isAll
            ? allIsFinish
              ? "Recorded as watched."
              : "Recorded as caught up — waiting on what comes next."
            : stance === "dropped"
              ? `Recorded as dropped after season ${value.season}.`
              : stance === "paused"
                ? `Recorded as paused after season ${value.season}.`
                : `Recorded as in progress, at season ${value.season}.`}
        </p>
      )}
    </div>
  );
}
