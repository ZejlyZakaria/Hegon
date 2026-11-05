"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Pulse, CarouselSkeleton } from "../shared/WatchingSkeletons";
import { AwardBackBar, AwardCeremonyControl } from "./AwardsControls";
import type { AwardCeremony } from "../../types";

export function AwardShelfSkeleton({ ceremony = "oscars", subtitle = "Award-winning titles you've seen", actions }: { ceremony?: AwardCeremony; subtitle?: string; actions?: ReactNode }) {
  return <CarouselSkeleton staticTitle title="Your trophy shelf" subtitle={subtitle} add={false} seeAll actions={actions ?? <AwardCeremonyControl ceremony={ceremony} />} />;
}

export function AwardCategoriesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-border-subtle bg-surface-1">
          <div className="flex h-42 gap-0.5 bg-surface-1">
            {[0, 1, 2].map((j) => <Pulse key={j} className="flex-1 rounded-none" />)}
          </div>
          <div className="p-3">
            <Pulse className="h-3.5 w-24 rounded-control" />
            <Pulse className="mt-2 h-2.5 w-20 rounded-control" />
            <Pulse className="mt-2 h-1 w-full rounded-control" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AwardCategoryGridSkeleton() {
  return (<div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 sm:p-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i}>
              <Pulse className="aspect-2/3 rounded-tile" />
              <Pulse className="mt-2 h-3 w-3/4 rounded-control" />
              <Pulse className="mt-1.5 h-2.5 w-1/2 rounded-control" />
            </div>
          ))}
        </div>);
}
export function CeremonyRowsSkeleton() {
  return (<div className="space-y-7 p-4 sm:p-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="relative mb-3 text-title"><span className="invisible">Category</span><Pulse className="absolute left-0 top-1/2 h-3.5 w-40 -translate-y-1/2" /></div>
              <div className="flex gap-3 overflow-hidden">{Array.from({ length: 5 }, (_, j) => <div key={j} className="w-28 shrink-0"><Pulse className="aspect-2/3 w-full rounded-tile" /><Pulse className="mt-1.5 h-4 w-3/4" /><Pulse className="mt-1 h-4 w-2/3" /></div>)}</div>
            </div>
          ))}
        </div>);
}
function AwardKickerSkeleton() { return <p className="relative text-caption uppercase"><span className="invisible">Oscars</span><Pulse className="absolute left-0 top-1/2 h-3 w-12 -translate-y-1/2" /></p>; }
export function AwardTitleSkeleton() { return <div className="mt-1 flex h-7 items-center"><Pulse className="h-5 w-40" /></div>; }
export function AwardSummarySkeleton() { return <div className="mt-1 flex h-4 items-center"><Pulse className="h-3 w-52" /></div>; }

export function AwardsSkeleton() {
  const params = useSearchParams();
  return <div role="status" aria-label="Loading awards" className="space-y-8 p-4 md:p-6"><AwardShelfSkeleton ceremony={params.get("c")==="emmys" ? "emmys" : "oscars"} /><section><SectionHeader title="Categories" subtitle="The canon, category by category — what you've seen, and what's left" /><AwardCategoriesSkeleton /></section></div>;
}
export function AwardCategorySkeleton() {
  return <div role="status" aria-label="Loading award category" className="flex flex-col"><AwardBackBar /><div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-5 sm:px-6"><div><AwardKickerSkeleton /><AwardTitleSkeleton /><AwardSummarySkeleton /></div><Pulse className="h-8 w-64 max-w-full" /></div><AwardCategoryGridSkeleton /></div>;
}
export function CeremonySkeleton() {
  return <div role="status" aria-label="Loading ceremony" className="flex flex-col"><AwardBackBar /><div className="px-4 pt-5 sm:px-6"><AwardKickerSkeleton /><AwardTitleSkeleton /><AwardSummarySkeleton /></div><CeremonyRowsSkeleton /></div>;
}
