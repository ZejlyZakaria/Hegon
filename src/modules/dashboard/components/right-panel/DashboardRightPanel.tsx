"use client";

import TodayWeatherCard from "@/modules/dashboard/components/today/TodayWeatherCard";
import DailyScoreWidget from "./DailyScoreWidget";
import WeeklyActivityWidget from "./WeeklyActivityWidget";

export default function DashboardRightPanel() {
  return (
    <div className="w-72 shrink-0 flex flex-col gap-4">
      <TodayWeatherCard variant="today" />
      <DailyScoreWidget />
      <WeeklyActivityWidget />
    </div>
  );
}
