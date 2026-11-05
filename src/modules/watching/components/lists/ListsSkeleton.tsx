import { Pulse } from "../shared/SkeletonPulse";

export function ListCardsSkeleton() {
  return (<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-1">
            <div className="flex h-42 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Pulse className="h-10 w-10 rounded-full" />
                <Pulse className="h-3 w-14 rounded-control" />
              </div>
            </div>
            <div className="border-t border-border-subtle p-3">
              <Pulse className="h-3.5 w-20 rounded-control" />
              <Pulse className="mt-2 h-2.5 w-4 rounded-control" />
            </div>
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-card border border-border-subtle bg-surface-1">
              <div className="flex h-42 gap-0.5 bg-surface-1">
                {[0, 1, 2].map((j) => (
                  <Pulse key={j} className="flex-1 rounded-none" />
                ))}
              </div>
              <div className="p-3">
                <Pulse className="h-3.5 w-24 rounded-control" />
                <Pulse className="mt-2 h-2.5 w-28 rounded-control" />
              </div>
            </div>
          ))}
        </div>);
}

export function ListsSkeleton() {
  return <div role="status" aria-label="Loading lists" className="p-4 md:p-6"><ListCardsSkeleton /></div>;
}
