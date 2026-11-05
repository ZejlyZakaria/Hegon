import { Pulse, CarouselSkeleton } from "../shared/WatchingSkeletons";
import { SectionHeader } from "@/shared/components/ui/section-header";

export function AnnouncementCardsSkeleton({ count = 4 }: { count?: number }) {
  return <div aria-hidden="true" className="flex gap-3 overflow-hidden py-1">{Array.from({ length: count }, (_, i) => <div key={i} data-announcement-skeleton className="bg-surface-1 ring-1 ring-inset ring-border-subtle flex min-w-0 shrink-0 basis-[90%] overflow-hidden rounded-card md:basis-[calc((100%-0.75rem)/2)] lg:basis-[calc((100%-1.5rem)/3)] xl:basis-[calc((100%-2.25rem)/4)]"><Pulse className="aspect-2/3 w-(--poster-md) shrink-0" /><div className="flex min-w-0 flex-1 flex-col px-3 py-2"><Pulse className="h-5 w-3/4" /><Pulse className="mt-1 h-4 w-20" /><div className="mt-auto pt-2"><Pulse className="h-4 w-24" /><Pulse className="mt-1 h-3 w-16" /></div></div></div>)}</div>;
}

export function UpdatesSkeleton() {
  return <div aria-label="Loading updates" role="status" className="space-y-6 p-4 sm:p-6">
    <CarouselSkeleton title="Available now" subtitle="Recent releases in the stories you follow." add={false} seeAll actions={<div className="flex flex-wrap items-center gap-2"><Pulse className="h-8 w-44" /></div>} />
    <section><SectionHeader title="Coming next" subtitle="The next seasons and parts on your horizon." /><AnnouncementCardsSkeleton /></section>
  </div>;
}
