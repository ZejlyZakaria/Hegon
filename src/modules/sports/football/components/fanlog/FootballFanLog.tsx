"use client";

// Fan Log — YOUR football diary: the matches you logged as watched (newest first), with where you
// watched + your rating. Independent section (own hook). Rows open the Match panel.

import Image from "next/image";
import { Tv, MapPin, Radio, Star } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useFanLog } from "../../hooks/useFanLog";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { displayCompetitionName } from "../../service";
import type { FanLogItem } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";
const WHERE_ICON = { tv: Tv, stadium: MapPin, live: Radio } as const;

export default function FootballFanLog() {
  const userId = useCurrentUserId();
  const { data: log } = useFanLog(userId);
  const open = useMatchPanel((s) => s.open);

  if (!log || log.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-base font-semibold text-text-primary">Fan Log</h2>
        <div className="rounded-card border border-border-subtle bg-surface-1 py-8 text-center text-sm text-text-tertiary">
          No matches logged yet — open a match and tap “I watched this match”.
        </div>
      </section>
    );
  }

  const stadium = log.filter((i) => i.watched_where === "stadium").length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">Fan Log</h2>
        <span className="text-xs text-text-tertiary">{log.length} watched · {stadium} at stadium</span>
      </div>
      <div className="flex flex-col gap-2">
        {log.map((i) => <FanRow key={i.external_match_id} i={i} onOpen={open} />)}
      </div>
    </section>
  );
}

function FanRow({ i, onOpen }: { i: FanLogItem; onOpen: (id: number) => void }) {
  const WhereIcon = i.watched_where ? WHERE_ICON[i.watched_where as keyof typeof WHERE_ICON] : undefined;
  const finished = i.home_score != null && i.away_score != null;
  return (
    <button
      onClick={() => onOpen(i.external_match_id)}
      className="flex w-full flex-col gap-1.5 rounded-card bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3"
    >
      <div className="flex items-center gap-2">
        <TeamMini name={i.home_name} crest={i.home_crest} align="left" />
        <span className="shrink-0 text-sm font-bold tabular-nums text-text-primary">
          {finished ? `${i.home_score}–${i.away_score}` : "vs"}
        </span>
        <TeamMini name={i.away_name} crest={i.away_crest} align="right" />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
        <span className="truncate">{displayCompetitionName(i.competition_name)}</span>
        <span>·</span>
        <span className="shrink-0">{fmtDate(i.utc_date)}</span>
        {WhereIcon && <WhereIcon size={11} className="shrink-0" />}
        {i.rating != null && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 font-semibold text-accent-sports">
            <Star size={11} className="fill-accent-sports" />
            {i.rating.toFixed(1)}
          </span>
        )}
      </div>
    </button>
  );
}

function TeamMini({ name, crest, align }: { name: string; crest: string | null; align: "left" | "right" }) {
  const img = (
    <span className="relative h-5 w-5 shrink-0">
      <Image src={crest || CREST_FALLBACK} alt={name} fill sizes="20px" className="object-contain" />
    </span>
  );
  const label = <span className="truncate text-sm text-text-primary">{name}</span>;
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "justify-end text-right" : ""}`}>
      {align === "left" ? (<>{img}{label}</>) : (<>{label}{img}</>)}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
