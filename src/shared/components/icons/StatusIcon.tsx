import type { StatusType } from "@/modules/tasks/types";
import { renderStatusIcon, TYPE_TO_ICON_KEY, type StatusIconKey } from "./status-icons";

const FALLBACK_COLORS: Record<StatusType, string> = {
  backlog:     "#6b7280",
  todo:        "#94a3b8",
  in_progress: "#3b82f6",
  done:        "#22c55e",
  cancelled:   "#ef4444",
};

interface StatusIconProps {
  status: { type: StatusType; color: string | null; icon?: string | null } | null | undefined;
  size?: number;
  className?: string;
}

export function StatusIcon({ status, size = 16, className = "" }: StatusIconProps) {
  const type  = status?.type  ?? "todo";
  const color = status?.color ?? FALLBACK_COLORS[type];
  const key   = (status?.icon ?? TYPE_TO_ICON_KEY[type]) as StatusIconKey;

  return renderStatusIcon(key, color, size, className);
}
