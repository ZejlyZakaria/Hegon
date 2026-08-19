"use client";

// The competition hero — the sibling of FootballTeamHero. You reach a club page and a competition
// page the same way, from the same lists, so they cannot look like they belong to different apps:
// same full-bleed band, same Back affordance, same bottom-anchored identity.
//
// What differs is the material. A club has fanart; a competition has a BRAND COLOUR and a logo, so
// the canvas is built from those — a wash of the competition's own colour with its logo blown up and
// blurred behind it. No stock photography, nothing invented: the page is painted in the colour the
// competition already carries in the database.

import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export interface CompetitionSeasonInfo {
  label: string;
  started: boolean;
  currentMatchday: number;
  totalMatchdays: number;
  progress: number;
  start: string;
  end: string;
}

interface Props {
  name: string;
  /** Colour (original) logo — the white variant disappears on a light brand wash. */
  logo: string | null;
  brand: string | null;
  season: CompetitionSeasonInfo | null;
  seasonComplete: boolean;
  onBack: () => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function FootballCompetitionHero({ name, logo, brand, season, seasonComplete, onBack }: Props) {
  const tint = brand ?? "var(--color-accent-sports)";

  return (
    <div className="relative overflow-hidden border-b border-border-subtle">
      {/* The canvas: the competition's own colour, plus its logo as an oversized blurred watermark.
          Both are already ours — no asset to source, and every competition gets one automatically. */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 140% at 15% 0%, ${tint}40, transparent 65%)` }} />
      {logo && (
        <div
          aria-hidden
          className="absolute -right-16 -top-24 h-[130%] w-2/3 opacity-[0.07]"
          style={{ backgroundImage: `url(${logo})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: "blur(2px)" }}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/40 to-transparent" />

      <div className="relative px-4 pb-7 pt-5 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="group mb-6 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-label text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>

        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-5 sm:text-left">
          <div className="relative h-20 w-20 shrink-0 drop-shadow-xl sm:h-24 sm:w-24">
            {logo ? (
              <Image src={logo} alt={name} fill sizes="96px" className="object-contain" />
            ) : (
              <div className="h-full w-full rounded-full" style={{ background: tint }} />
            )}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">{name}</h1>
            {season?.label && (
              <p className="mt-1 text-sm text-text-tertiary">
                {season.label}
                {seasonComplete && <span className="ml-2 text-text-tertiary">· Season complete</span>}
              </p>
            )}
          </div>

          {/* Progress sits in the hero rather than under it: how far into the season we are is part of
              the competition's identity right now, not a separate widget. */}
          {season && (
            <div className="w-full sm:w-56 sm:shrink-0">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-tertiary">
                {season.started ? (
                  <>
                    <span>Matchday {season.currentMatchday}</span>
                    <span>of {season.totalMatchdays}</span>
                  </>
                ) : (
                  <>
                    <span>{fmtDate(season.start)}</span>
                    <span>{fmtDate(season.end)}</span>
                  </>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(season.progress * 100)}%`, background: tint }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
