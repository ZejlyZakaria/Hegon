"use client";

import Image from "next/image";
import Link from "next/link";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import type { DashboardData, DashboardTask, DashboardSportEvent } from "../../types";
import { COMPETITION_LOGO, PRIORITY_ORDER, GRACE_MS, PARIS_TZ } from "../../constants";

// ── helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#52525b",
};

function getTodayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
}

function formatTime(dateStr: string): string | null {
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS_TZ,
  });
  if (time === "00:00") return null;
  return time;
}

// ── shared ────────────────────────────────────────────────────────────────────

function ColLabel({ label, dotColor }: { label: string; dotColor?: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-2.5 border-b border-zinc-800/60">
      {dotColor && (
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      )}
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">{label}</p>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <div className="w-1.5 h-1.5 rounded-full mt-1.25 shrink-0" style={{ backgroundColor: color }} />
  );
}

// ── PRIORITY column — today + overdue only ────────────────────────────────────

function PriorityColumn({ tasks }: { tasks: DashboardTask[] }) {
  const todayStr = getTodayStr();

  const filtered = tasks
    .filter((t) => t.due_date && t.due_date.slice(0, 10) <= todayStr)
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 3;
      const pb = PRIORITY_ORDER[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
    });

  const shown = filtered.slice(0, 5);

  return (
    <div className="p-4 flex flex-col gap-2.5">
      <ColLabel label="Priority" dotColor="#f97316" />
      {shown.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-2xl opacity-20">✅</span>
          <p className="text-[11px] text-zinc-700">All clear today</p>
        </div>
      ) : (
        shown.map((task) => {
          const isOverdue = task.due_date!.slice(0, 10) < todayStr;
          const time = formatTime(task.due_date!);
          return (
            <div key={task.id} className="flex items-start gap-2.5">
              <Dot color={PRIORITY_DOT[task.priority] ?? "#52525b"} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-zinc-200 leading-snug line-clamp-1">
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-zinc-600 truncate">{task.project_name}</span>
                  <span className="text-[10px] text-zinc-800">·</span>
                  {isOverdue ? (
                    <span className="text-[10px] text-red-500/70 shrink-0">overdue</span>
                  ) : time ? (
                    <span className="text-[10px] text-zinc-500 shrink-0 tabular-nums">{time}</span>
                  ) : (
                    <span className="text-[10px] text-zinc-600 shrink-0">today</span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      {filtered.length > 5 && (
        <Link href="/pro/tasks" className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors pl-4">
          +{filtered.length - 5} more
        </Link>
      )}
    </div>
  );
}

// ── IN PROGRESS column — top 2 goals ─────────────────────────────────────────

function InProgressGoalColumn() {
  const { data: goals = [], isLoading } = useGoals();

  const active = goals.filter((g) => g.status === "active");
  const sorted = [...active].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    if (a.target_date && b.target_date)
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    return 0;
  });

  const shown = sorted.slice(0, 2);
  const remaining = active.length - 2;

  return (
    <div className="p-4 flex flex-col gap-2.5">
      <ColLabel label="In Progress" dotColor="#22c55e" />
      {isLoading ? (
        <div className="flex flex-col animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className={`flex flex-col gap-2 py-2 ${i > 0 ? "border-t border-zinc-800/50" : ""}`}>
              <div className="h-2 w-10 rounded bg-surface-2" />
              <div className="h-3 w-3/4 rounded bg-surface-2" />
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-0.75 rounded-full bg-surface-2" />
                <div className="h-2.5 w-6 rounded bg-surface-2 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-2xl opacity-20">🎯</span>
          <p className="text-[11px] text-zinc-700">No active goals</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {shown.map((goal, i) => (
            <div
              key={goal.id}
              className={`flex flex-col gap-2 py-2 ${i > 0 ? "border-t border-zinc-800/50" : ""}`}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-green-500/80">
                {goal.category}
              </span>
              <p className="text-[12px] font-semibold text-zinc-100 leading-snug line-clamp-1">
                {goal.title}
              </p>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-0.75 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${goal.progress}%`, backgroundColor: "#22c55e" }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-zinc-500 tabular-nums shrink-0">
                  {goal.progress}%
                </span>
              </div>
              {goal.target_date && (
                <p className="text-[10px] text-zinc-600">
                  Due{" "}
                  {new Date(goal.target_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <Link
              href="/perso/goals"
              className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors pt-1.5 border-t border-zinc-800/50"
            >
              +{remaining} more goal{remaining > 1 ? "s" : ""}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── UP NEXT column — stacked compact events ───────────────────────────────────

function FeaturedFootball({ event }: { event: DashboardSportEvent }) {
  const compLogo = event.competition ? (COMPETITION_LOGO[event.competition] ?? null) : null;
  const time = formatTime(event.date);

  return (
    <Link href={event.href} className="flex flex-col items-center justify-center gap-3 h-full group">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1.5">
          {event.homeTeamCrest ? (
            <div className="relative w-12 h-12">
              <Image src={event.homeTeamCrest} alt={event.homeTeam ?? ""} fill className="object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl">⚽</div>
          )}
          <span className="text-[9px] font-semibold text-zinc-400 text-center line-clamp-2 w-16 leading-tight">
            {event.homeTeam}
          </span>
        </div>
        <span className="text-[11px] font-black text-zinc-700">VS</span>
        <div className="flex flex-col items-center gap-1.5">
          {event.awayTeamCrest ? (
            <div className="relative w-12 h-12">
              <Image src={event.awayTeamCrest} alt={event.awayTeam ?? ""} fill className="object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl">⚽</div>
          )}
          <span className="text-[9px] font-semibold text-zinc-400 text-center line-clamp-2 w-16 leading-tight">
            {event.awayTeam}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {compLogo && (
          <div className="relative w-8 h-4 shrink-0">
            <Image src={compLogo} alt={event.competition ?? ""} fill unoptimized className="object-contain"
              style={{ filter: "brightness(0) invert(1)", opacity: 0.4 }} />
          </div>
        )}
        <p className="text-[9px] text-zinc-600">
          {[event.competition, time].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

function FeaturedTennis({ event }: { event: DashboardSportEvent }) {
  const time = formatTime(event.date);
  const isMatch = !!event.playerName;

  if (!isMatch) {
    return (
      <Link href={event.href} className="flex flex-col justify-center gap-2.5 h-full group">
        <div className="relative w-10 h-5">
          <Image src="/assets/dashboard/ATP-white-logo.webp" alt="ATP" fill unoptimized
            className="object-contain object-left" style={{ opacity: 0.4 }} />
        </div>
        <p className="text-[13px] font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors">
          {event.title}
        </p>
        {event.subtitle && <p className="text-[10px] text-zinc-500">{event.subtitle}</p>}
        {time && <p className="text-[10px] text-zinc-600 tabular-nums">{time}</p>}
      </Link>
    );
  }

  return (
    <Link href={event.href} className="flex flex-col items-center justify-center gap-3 h-full group">
      {event.playerPhotoUrl ? (
        <div className="relative w-16 h-16 rounded-full overflow-hidden border border-amber-500/25 shrink-0">
          <Image src={event.playerPhotoUrl} alt={event.playerName ?? ""} fill unoptimized className="object-cover object-top" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-zinc-800 border border-amber-500/20 flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-amber-400/70">
            {event.playerName?.slice(0, 2).toUpperCase() ?? "?"}
          </span>
        </div>
      )}
      <div className="text-center">
        <p className="text-[13px] font-semibold text-zinc-100 group-hover:text-white transition-colors">
          {event.playerName}
        </p>
        {event.opponentName && (
          <p className="text-[11px] text-zinc-500 mt-0.5">vs {event.opponentName}</p>
        )}
        {event.tournamentName && (
          <p className="text-[10px] text-zinc-600 mt-0.5">{event.tournamentName}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {event.round && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-500/70">{event.round}</span>
        )}
        {time && <span className="text-[10px] text-zinc-500 tabular-nums">{time}</span>}
      </div>
    </Link>
  );
}

function FeaturedF1({ event }: { event: DashboardSportEvent }) {
  return (
    <Link href={event.href} className="flex flex-col justify-center gap-2.5 h-full group">
      <div className="relative w-14 h-7">
        <Image src="/assets/dashboard/F1-white-logo.png" alt="F1" fill unoptimized className="object-contain object-left" />
      </div>
      <p className="text-[13px] font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors">
        {event.title}
      </p>
      {event.circuit && (
        <p className="text-[10px] text-zinc-500">{event.circuit}</p>
      )}
      <p className="text-[10px] text-zinc-600">{[event.country, event.subtitle].filter(Boolean).join(" · ")}</p>
    </Link>
  );
}

function CompactFootball({ event }: { event: DashboardSportEvent }) {
  const compLogo = event.competition ? (COMPETITION_LOGO[event.competition] ?? null) : null;
  const time = formatTime(event.date);

  return (
    <Link href={event.href} className="flex items-center gap-2.5 group">
      <div className="flex items-center gap-1 shrink-0">
        {event.homeTeamCrest ? (
          <div className="relative w-8 h-8"><Image src={event.homeTeamCrest} alt={event.homeTeam ?? ""} fill sizes="32px" className="object-contain" /></div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm">⚽</div>
        )}
        <span className="text-[8px] font-black text-zinc-700 px-0.5">vs</span>
        {event.awayTeamCrest ? (
          <div className="relative w-8 h-8"><Image src={event.awayTeamCrest} alt={event.awayTeam ?? ""} fill sizes="32px" className="object-contain" /></div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm">⚽</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-zinc-200 line-clamp-1 group-hover:text-white transition-colors">
          {event.homeTeam} vs {event.awayTeam}
        </p>
        <p className="text-[9px] text-zinc-600 truncate">
          {[event.competition, time].filter(Boolean).join(" · ")}
        </p>
      </div>
      {compLogo && (
        <div className="relative w-8 h-4 shrink-0">
          <Image src={compLogo} alt={event.competition ?? ""} fill unoptimized className="object-contain object-right"
            style={{ filter: "brightness(0) invert(1)", opacity: 0.4 }} />
        </div>
      )}
    </Link>
  );
}

function CompactTennis({ event }: { event: DashboardSportEvent }) {
  const time = formatTime(event.date);
  const isMatch = !!event.playerName;

  return (
    <Link href={event.href} className="flex items-center gap-2.5 group">
      {isMatch ? (
        event.playerPhotoUrl ? (
          <div className="relative w-9 h-9 shrink-0 rounded-full overflow-hidden border border-amber-500/20">
            <Image src={event.playerPhotoUrl} alt={event.playerName ?? ""} fill unoptimized className="object-cover object-top" />
          </div>
        ) : (
          <div className="w-9 h-9 shrink-0 rounded-full bg-zinc-800 border border-amber-500/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-amber-400/70">
              {event.playerName?.slice(0, 2).toUpperCase() ?? "?"}
            </span>
          </div>
        )
      ) : (
        <div className="relative w-9 h-5 shrink-0">
          <Image src="/assets/dashboard/ATP-white-logo.webp" alt="ATP" fill unoptimized
            className="object-contain object-left" style={{ opacity: 0.35 }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
          {isMatch ? event.playerName : event.title}
        </p>
        {isMatch && event.opponentName && (
          <p className="text-[9px] text-zinc-500 truncate">vs {event.opponentName}</p>
        )}
        <p className="text-[9px] text-zinc-600 truncate">
          {[isMatch ? event.tournamentName : event.subtitle, time].filter(Boolean).join(" · ")}
        </p>
      </div>
      {isMatch && (
        <div className="relative w-8 h-4 shrink-0">
          <Image src="/assets/dashboard/ATP-white-logo.webp" alt="ATP" fill unoptimized
            className="object-contain object-right" style={{ opacity: 0.3 }} />
        </div>
      )}
    </Link>
  );
}

function CompactF1({ event }: { event: DashboardSportEvent }) {
  return (
    <Link href={event.href} className="flex items-center gap-2.5 group">
      <div className="relative w-10 h-5 shrink-0">
        <Image src="/assets/dashboard/F1-white-logo.png" alt="F1" fill unoptimized className="object-contain object-left" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{event.title}</p>
        <p className="text-[9px] text-zinc-600 truncate">
          {[event.circuit, event.subtitle].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="text-[8px] font-bold uppercase tracking-widest text-red-400 shrink-0">F1</span>
    </Link>
  );
}

function EventBlock({ event, featured }: { event: DashboardSportEvent; featured: boolean }) {
  if (featured) {
    if (event.type === "football") return <FeaturedFootball event={event} />;
    if (event.type === "tennis") return <FeaturedTennis event={event} />;
    if (event.type === "f1") return <FeaturedF1 event={event} />;
  }
  if (event.type === "football") return <CompactFootball event={event} />;
  if (event.type === "tennis") return <CompactTennis event={event} />;
  if (event.type === "f1") return <CompactF1 event={event} />;
  return null;
}

function UpNextColumn({ events }: { events: DashboardSportEvent[] }) {
  const shown = events.slice(0, 2);
  const moreCount = events.length - 2;
  const single = shown.length === 1;

  return (
    <div className="p-4 flex flex-col gap-2.5 h-full">
      <ColLabel label="Up Next" dotColor="#8b5cf6" />
      {shown.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-2xl opacity-20">📅</span>
          <p className="text-[11px] text-zinc-700">No events today</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {shown.map((event, i) => (
            <div
              key={`${event.type}-${event.date}`}
              className={`flex flex-col flex-1 min-h-0 justify-center ${i > 0 ? "border-t border-zinc-800/40 pt-2 mt-2" : ""}`}
            >
              <EventBlock event={event} featured={single} />
            </div>
          ))}
          {moreCount > 0 && (
            <p className="text-[10px] text-zinc-700 pt-2 border-t border-zinc-800/40 mt-2 shrink-0">
              +{moreCount} more event{moreCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

interface Props {
  data: DashboardData;
}

export default function TodaySection({ data }: Props) {
  const now = new Date();

  const allTodayEvents: DashboardSportEvent[] = [
    ...data.todayFootballEvents,
    ...data.todayTennisEvents,
    ...(data.todayF1Event ? [data.todayF1Event] : []),
  ].filter((e) => new Date(e.date).getTime() > now.getTime() - GRACE_MS);

  allTodayEvents.sort((a, b) => {
    const aMain = a.type === "football" && a.isMainTeam;
    const bMain = b.type === "football" && b.isMainTeam;
    if (aMain && !bMain) return -1;
    if (bMain && !aMain) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const upNextEvents =
    allTodayEvents.length > 0
      ? allTodayEvents
      : data.upNextEvent
      ? [data.upNextEvent]
      : [];

  return (
    <section>
      <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-zinc-800/50">
          <PriorityColumn tasks={data.tasks} />
          <InProgressGoalColumn />
          <UpNextColumn events={upNextEvents} />
        </div>
      </div>
    </section>
  );
}
