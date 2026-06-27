// Transparent skeleton — the layout's wallpaper + glass dock are already painted
// behind this, so the home fades in over them with no dark flash.

function Block({ className }: { className: string }) {
  return <div className={`glass-panel animate-pulse rounded-[22px] ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col gap-7 px-8 py-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-40 animate-pulse rounded bg-white/8" />
      </div>

      <div className="flex flex-1 gap-8">
        <div className="grid w-[360px] shrink-0 grid-cols-2 content-start gap-4">
          <Block className="h-[148px]" />
          <Block className="h-[148px]" />
          <Block className="col-span-2 h-[148px]" />
          <Block className="col-span-2 h-[148px]" />
        </div>
        <div className="grid flex-1 grid-cols-5 content-start gap-x-5 gap-y-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="h-[60px] w-[60px] animate-pulse rounded-2xl bg-white/10" />
              <div className="h-2.5 w-10 animate-pulse rounded bg-white/8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
