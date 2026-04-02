import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardTodayTasks } from "@/components/dashboard/DashboardTodayTasks";
import {
  DashboardFootballCard,
  DashboardTennisCard,
  DashboardF1Card,
} from "@/components/dashboard/DashboardSportCards";
import { DashboardWatchingWidget } from "@/components/dashboard/DashboardWatchingWidget";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#09090b] overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <DashboardHeader />

        {/* 2-col grid — 2/3 tasks + 1/3 sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left — Today's Tasks (2/3) */}
          <div className="lg:col-span-2 min-h-130 flex flex-col">
            <DashboardTodayTasks />
          </div>

          {/* Right — Sport + Watching (1/3) */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            <DashboardFootballCard />
            <DashboardTennisCard />
            <DashboardF1Card />
            <DashboardWatchingWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
