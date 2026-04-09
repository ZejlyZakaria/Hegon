import TodayPriorityCard from "./TodayPriorityCard";
import TodayUpNextCard from "./TodayUpNextCard";
import TodayQuoteCard from "./TodayQuoteCard";
import TodayWeatherCard from "./TodayWeatherCard";
import TodayRightSlot from "./TodayRightSlot";
import type { DashboardData } from "../../types";

interface Props {
  data: DashboardData;
}

export default function TodaySection({ data }: Props) {
  const task = data.priorityTask ?? null;
  const football = data.todayFootballEvents;
  const tennis = data.todayTennisEvents;
  const f1 = data.todayF1Event;

  // F1 race day: move F1 to middle column (replace quote) when other sports exist
  const hasOtherSports = football.length > 0 || tennis.length > 0;
  const f1InMiddle = f1 !== null && hasOtherSports;

  const totalEvents =
    football.length + tennis.length + (f1 && !f1InMiddle ? 1 : 0);

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
        {/* Left: priority task (or weather if none) */}
        {task ? (
          <TodayPriorityCard task={task} remaining={Math.max(0, data.tasks.length - 1)} />
        ) : (
          <TodayWeatherCard variant="mid" />
        )}

        {/* Middle: quote — or F1 card on race day when other sports also exist */}
        {f1InMiddle ? (
          <TodayUpNextCard event={f1} label="Race Day" />
        ) : (
          <TodayQuoteCard />
        )}

        {/* Right: sport events — all cases handled in TodayRightSlot */}
        <TodayRightSlot
          football={football}
          tennis={tennis}
          f1={f1InMiddle ? null : f1}
        />
      </div>
    </section>
  );
}
