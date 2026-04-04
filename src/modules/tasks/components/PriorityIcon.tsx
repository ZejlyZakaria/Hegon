import { cn } from "@/shared/utils/utils"
import { TriangleAlert } from "lucide-react";
import type { Priority } from "@/modules/tasks/types"

interface PriorityIconProps {
  priority: Priority | "none";
  className?: string;
}

export function PriorityIcon({ priority, className }: PriorityIconProps) {
  // Critical: Red triangle alert with border (same style as bars)
  if (priority === "critical") {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          className,
        )}
      >
        <TriangleAlert size={14} className="text-red-600"  />
      </div>
    );
  }

  // Network bars configuration
  const priorityBarConfig = {
    none: {
      activeBars: 0,
      activeColor: "bg-zinc-300",
      inactiveColor: "bg-zinc-300",
    },
    low: {
      activeBars: 1,
      activeColor: "bg-zinc-500",
      inactiveColor: "bg-zinc-700",
    },
    medium: {
      activeBars: 2,
      activeColor: "bg-yellow-500",
      inactiveColor: "bg-zinc-700",
    },
    high: {
      activeBars: 3,
      activeColor: "bg-orange-500",
      inactiveColor: "bg-zinc-700",
    },
  };

  const { activeBars, activeColor, inactiveColor } =
    priorityBarConfig[priority as "none" | "low" | "medium" | "high"];

  return (
    <div
      className={cn(
        "flex items-end gap-0.5 px-0.5",
        className,
      )}
    >
      {/* Bar 1 - Active for low/medium/high */}
      <div
        className={cn(
          "w-[2.5px] rounded-sm",
          activeBars >= 1 ? activeColor : inactiveColor,
          "h-1.25",
        )}
      />

      {/* Bar 2 - Active for medium/high only */}
      <div
        className={cn(
          "w-[2.5px] rounded-sm",
          activeBars >= 2 ? activeColor : inactiveColor,
          "h-2",
        )}
      />

      {/* Bar 3 - Active for high only */}
      <div
        className={cn(
          "w-[2.5px] rounded-sm",
          activeBars >= 3 ? activeColor : inactiveColor,
          "h-2.75",
        )}
      />
    </div>
  );
}