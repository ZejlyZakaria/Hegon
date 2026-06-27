// Sport event cards — one rich M-card per event, shape adapts to the sport.
// STATIC data for now (UX prototype); the real time-filtered feed comes with
// Sport V2. Card visuals are stable regardless.

export type SportEvent =
  | { sport: "football"; home: string; away: string; homeColor: string; awayColor: string; comp: string; time: string }
  | { sport: "tennis"; player: string; opponent: string; tournament: string; round: string; time: string }
  | { sport: "f1"; gp: string; circuit: string; country: string; session: string; time: string };

const ACCENT = { football: "#10b981", tennis: "#f59e0b", f1: "#ef4444" } as const;

function Frame({
  accent, eyebrow, time, children,
}: {
  accent: string; eyebrow: string; time: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-panel relative flex h-full w-full flex-col overflow-hidden rounded-[22px] p-3.5">
      <div className="flex items-center justify-between">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          <span className="truncate">{eyebrow}</span>
        </span>
        <span className="shrink-0 pr-3 text-[11px] font-semibold tabular-nums text-white/80">{time}</span>
      </div>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="grid h-10 w-10 place-items-center rounded-full text-[11px] font-bold text-white shadow-md"
        style={{ background: `linear-gradient(155deg, ${color}, ${color}99)` }}
      >
        {label.slice(0, 3).toUpperCase()}
      </div>
      <span className="max-w-18 truncate text-[11px] font-medium text-white/85">{label}</span>
    </div>
  );
}

export function SportCard({ event }: { event: SportEvent }) {
  if (event.sport === "football") {
    return (
      <Frame accent={ACCENT.football} eyebrow={event.comp} time={event.time}>
        <div className="flex items-center justify-center gap-5">
          <Badge label={event.home} color={event.homeColor} />
          <span className="text-[12px] font-black text-white/35">VS</span>
          <Badge label={event.away} color={event.awayColor} />
        </div>
      </Frame>
    );
  }

  if (event.sport === "tennis") {
    return (
      <Frame accent={ACCENT.tennis} eyebrow={`${event.tournament} · ${event.round}`} time={event.time}>
        <div className="flex items-center justify-center gap-5">
          <Badge label={event.player} color="#f59e0b" />
          <span className="text-[12px] font-black text-white/35">VS</span>
          <Badge label={event.opponent} color="#71717a" />
        </div>
      </Frame>
    );
  }

  return (
    <Frame accent={ACCENT.f1} eyebrow="Formula 1" time={event.time}>
      <div className="flex w-full items-center gap-3.5 px-1">
        <div className="grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-[#e10600] text-[12px] font-black italic text-white shadow-md">
          F1
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">{event.gp}</p>
          <p className="truncate text-[11px] text-white/55">{event.circuit} · {event.country}</p>
        </div>
        <span className="shrink-0 rounded-chip bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
          {event.session}
        </span>
      </div>
    </Frame>
  );
}
