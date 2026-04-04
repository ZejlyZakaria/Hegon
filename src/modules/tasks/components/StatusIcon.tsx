import type { Status } from "@/modules/tasks/types"

interface StatusIconProps {
  status: Status["name"];
  size?: number;
  className?: string;
}

export function StatusIcon({ status, size = 16, className = "" }: StatusIconProps) {
  const getStatusIcon = () => {
    const normalizedStatus = status.toLowerCase();

    // Backlog - Dashed circle (orange)
    if (normalizedStatus === "backlog") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            fill="none"
            className="text-orange-500"
          />
        </svg>
      );
    }

    // To Do / Planned - Empty circle (gray)
    if (normalizedStatus === "to do" || normalizedStatus === "todo" || normalizedStatus === "planned") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            className="text-zinc-500"
          />
        </svg>
      );
    }

    // In Progress - Half-filled circle (yellow)
    if (normalizedStatus === "in progress" || normalizedStatus === "inprogress") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            className="text-yellow-500"
          />
          <path
            d="M 8 2 A 6 6 0 0 1 8 14 Z"
            fill="currentColor"
            className="text-yellow-500"
          />
        </svg>
      );
    }

    // Done / Completed - Circle with checkmark (blue)
    if (normalizedStatus === "done" || normalizedStatus === "completed") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="currentColor"
            className="text-blue-500"
          />
          <path
            d="M 5.5 8 L 7 9.5 L 10.5 6"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    }

    // Canceled - Circle with X (gray)
    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            className="text-zinc-600"
          />
          <path
            d="M 6 6 L 10 10 M 10 6 L 6 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-zinc-600"
          />
        </svg>
      );
    }

    // Default - Empty circle
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className="text-zinc-500"
        />
      </svg>
    );
  };

  return getStatusIcon();
}