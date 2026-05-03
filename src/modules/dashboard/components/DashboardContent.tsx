"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/infrastructure/supabase/client";
import { useDashboardData } from "@/modules/dashboard/hooks/useDashboardData";
import DashboardHeader from "./header/DashboardHeader";
import TodaySection from "./today/TodaySection";
import DashboardRightPanel from "./right-panel/DashboardRightPanel";
import LifeStatsRow from "./row2/LifeStatsRow";
import MediaSportsRow from "./row3/MediaSportsRow";

function SectionSkeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-xl bg-zinc-800/50 animate-pulse ${className}`} />;
}

export default function DashboardContent() {
  const { data, isLoading, error } = useDashboardData();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        const user = session?.user;
        const name =
          user?.user_metadata?.full_name?.split(" ")[0] ??
          user?.user_metadata?.name?.split(" ")[0] ??
          user?.email?.split("@")[0] ??
          "there";
        setUserName(name);
      });
  }, []);

  return (
    <div className="px-6 py-5 flex flex-col gap-6">
      <DashboardHeader userName={userName} />

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-6">

          {error ? (
            <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-5 text-center">
              <p className="text-sm text-red-400">Failed to load dashboard data. Please refresh.</p>
            </div>
          ) : (
            <>
              {data ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <TodaySection data={data} />
                </motion.div>
              ) : isLoading ? (
                <SectionSkeleton className="h-36" />
              ) : null}

              <LifeStatsRow />

              {data ? (
                <MediaSportsRow data={data} />
              ) : isLoading ? (
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <SectionSkeleton key={i} className="h-44" />
                  ))}
                </div>
              ) : null}
            </>
          )}

        </div>

        <DashboardRightPanel />
      </div>
    </div>
  );
}
