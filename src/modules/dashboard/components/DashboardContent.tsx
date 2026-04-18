"use client";

import { useDashboardData } from "@/modules/dashboard/hooks/useDashboardData";
import DashboardHeader from "./header/DashboardHeader";
import TodaySection from "./today/TodaySection";
import ContinueWatchingSection from "./continue-watching/ContinueWatchingSection";
import UpcomingSportsSection from "./upcoming-sports/UpcomingSportsSection";
import TasksSection from "./tasks/TasksSection";

interface Props {
  userName: string;
}

export default function DashboardContent({ userName }: Props) {
  const { data, isLoading } = useDashboardData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-6">
      <DashboardHeader
        userName={userName}
        hasTask={!!data?.tasks?.length}
        hasMatch={!!data?.todaySportEvents?.length}
      />

      {!isLoading && data && (
        <>
          <TodaySection data={data} />

          {(data.inProgressMediaList.length > 0 || data.sportEvents.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ContinueWatchingSection mediaList={data.inProgressMediaList} />
              <UpcomingSportsSection events={data.sportEvents} />
            </div>
          )}
        </>
      )}

      <TasksSection />
    </div>
  );
}
