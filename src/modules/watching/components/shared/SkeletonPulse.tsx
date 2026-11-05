import { cn } from "@/shared/utils/utils";

/** One placeholder surface and pulse; layout belongs to each page skeleton. */
export function Pulse({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-control bg-surface-2", className)} />;
}
