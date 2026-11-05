"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Panel } from "@/shared/components/ui/panel";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { useWatchingUpdates } from "../../hooks/useWatchingUpdates";
import { useWatchActions } from "../../hooks/useWatchActions";
import { buildWatchingUpdates, isUpdateVisible } from "../../lib/updates";
import { AvailableUpdates } from "./AvailableUpdates";
import { UpdatesSkeleton } from "./UpdatesSkeleton";
import { AnnouncementUpdates } from "./AnnouncementUpdates";

type Filter = "all" | "serie" | "anime";
const FILTERS: { value: Filter; label: string }[] = [{ value: "all", label: "All" }, { value: "serie", label: "Series" }, { value: "anime", label: "Anime" }];
const day = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };

export function UpdatesPage({ userId }: { userId: string }) {
  const query = useWatchingUpdates(userId);
  const router = useRouter();
  const actions = useWatchActions(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [resuming, setResuming] = useState<string | null>(null);
  const [today, setToday] = useState(day);
  useEffect(() => { const timer = setInterval(() => setToday(day()), 60_000); return () => clearInterval(timer); }, []);
  const updates = useMemo(() => query.data ? buildWatchingUpdates(query.data, today) : [], [query.data, today]);
  const visible = updates.filter(update => (filter === "all" || update.media.type === filter) && isUpdateVisible(update));
  const available = visible.filter(update => update.state === "available");
  const upcoming = visible.filter(update => update.state === "upcoming");
  const tba = visible.filter(update => update.state === "tba");

  const filters = (<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><SegmentedControl items={FILTERS} value={filter} onChange={setFilter} size="sm" /></div>);

  if (query.isPending) return <UpdatesSkeleton />;
  if (!query.data) return <div className="p-4 sm:p-6"><Panel title="Updates"><p role="alert" className="text-sm text-text-secondary">We couldn&apos;t load your updates.</p><Button className="mt-4" onClick={() => void query.refetch()}>Try again</Button></Panel></div>;

  return <div className="space-y-6 p-4 sm:p-6">
    {query.isError && <p role="status" className="text-xs text-text-secondary">Showing saved updates. Refresh is temporarily unavailable. <button type="button" onClick={() => void query.refetch()} className="underline underline-offset-4">Try again</button></p>}
    <AvailableUpdates actions={filters} updates={available} resuming={resuming} onOpen={update => {
      if (resuming) return;
      if (update.media.want_to_watch || update.media.in_progress && !update.media.paused && !update.media.dropped && !update.media.resume_required) { router.push(`/perso/watching/${update.media.id}`); return; }
      setResuming(update.media.id);
      void actions.resumeItem(update.media).then(saved => { if (saved) router.push(`/perso/watching/${update.media.id}`); }).finally(() => setResuming(null));
    }} />
    <AnnouncementUpdates updates={upcoming} title="Coming next" subtitle="The next seasons and parts on your horizon." actions={!available.length ? filters : undefined} />
    <AnnouncementUpdates updates={tba} title="Date to be announced" subtitle="On the horizon, without a confirmed date." actions={!available.length && !upcoming.length ? filters : undefined} />
    {!visible.length && <div className="flex flex-wrap items-center gap-3">{filters}</div>}
    {!visible.length && <p className="flex items-center gap-2 text-xs text-text-tertiary"><CalendarClock size={14} />Updates follow your started series, anime and recent watchlist releases.</p>}
    <p className="text-xs text-text-tertiary">Release dates may change. New availability follows the latest catalogue sync.</p>
  </div>;
}
