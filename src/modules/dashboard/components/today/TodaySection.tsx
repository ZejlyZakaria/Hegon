import TodayPriorityCard from "./TodayPriorityCard";
import TodayUpNextCard from "./TodayUpNextCard";
import TodayQuoteCard from "./TodayQuoteCard";
import TodayWeatherCard from "./TodayWeatherCard";
import type { DashboardData, DashboardSportEvent, DashboardTask } from "../../types";

// ─── Slot components ──────────────────────────────────────────────────────────

function LeftSlot({
  task,
  match,
}: {
  task: DashboardTask | null;
  match: DashboardSportEvent | null;
}) {
  if (task) return <TodayPriorityCard task={task} />;
  if (match) return <TodayUpNextCard event={match} label="Today" />;
  return <TodayWeatherCard variant="mid" />;
}

function RightSlot({
  task,
  todayMatches,
  isEmpty,
}: {
  task: DashboardTask | null;
  todayMatches: DashboardSportEvent[];
  isEmpty: boolean;
}) {
  // Cases with a task
  if (task) {
    if (todayMatches.length >= 2) {
      // Case 3 — task + 2 sports: stacked compact cards
      return (
        <div className="flex flex-col gap-2 h-full">
          <TodayUpNextCard event={todayMatches[0]} label="Today" compact />
          <TodayUpNextCard event={todayMatches[1]} label="Today" compact />
        </div>
      );
    }
    if (todayMatches.length === 1) {
      // Case 2 — task + 1 sport
      return <TodayUpNextCard event={todayMatches[0]} label="Today" />;
    }
    // Case 1 — task only
    return <TodayWeatherCard variant="mid" />;
  }

  // Cases without a task
  if (todayMatches.length >= 2) {
    // Case 5 — 2 sports, each in own column
    return <TodayUpNextCard event={todayMatches[1]} label="Today" />;
  }
  if (todayMatches.length === 1) {
    // Case 4 — 1 sport + weather
    return <TodayWeatherCard variant="mid" />;
  }
  // Case 6 — empty: week forecast
  return <TodayWeatherCard variant="week" />;
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  data: DashboardData;
}

export default function TodaySection({ data }: Props) {
  const task = data.tasks[0] ?? null;
  const todayMatches = data.todaySportEvents.slice(0, 2);
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-3.5 rounded-full bg-blue-400" />
          <h2 className="text-base font-semibold text-white tracking-tight">Today</h2>
          <span className="text-xs text-zinc-500 italic">· what matters right now</span>
        </div>
        {data.tasks.length > 0 && (
          <span className="text-[11px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
            {data.tasks.length} priorit{data.tasks.length > 1 ? "ies" : "y"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[35fr_30fr_35fr] gap-3">
        <LeftSlot task={task} match={todayMatches[0] ?? null} />
        <TodayQuoteCard />
        <RightSlot task={task} todayMatches={todayMatches} isEmpty={!task && todayMatches.length === 0} />
      </div>
    </section>
  );
}
