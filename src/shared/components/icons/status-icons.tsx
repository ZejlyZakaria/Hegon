import type { StatusType } from "@/modules/tasks/types";

export type StatusIconKey =
  | "circle_dashed"
  | "circle_empty"
  | "circle_dot"
  | "circle_quarter"
  | "circle_half"
  | "circle_three_quarter"
  | "circle_full"
  | "circle_check"
  | "circle_x"
  | "circle_minus"
  | "circle_clock"
  | "circle_arrow_up"
  | "circle_arrows"
  | "circle_pause"
  | "circle_eye"
  | "circle_flash"
  | "circle_flag"
  | "circle_star"
  | "circle_alert"
  | "circle_question";

export const ALL_STATUS_ICON_KEYS: StatusIconKey[] = [
  "circle_dashed",
  "circle_empty",
  "circle_dot",
  "circle_quarter",
  "circle_half",
  "circle_three_quarter",
  "circle_full",
  "circle_check",
  "circle_x",
  "circle_minus",
  "circle_clock",
  "circle_arrow_up",
  "circle_arrows",
  "circle_pause",
  "circle_eye",
  "circle_flash",
  "circle_flag",
  "circle_star",
  "circle_alert",
  "circle_question",
];

export const TYPE_TO_ICON_KEY: Record<StatusType, StatusIconKey> = {
  backlog:     "circle_dashed",
  todo:        "circle_empty",
  in_progress: "circle_quarter",
  done:        "circle_check",
  cancelled:   "circle_x",
};

export function renderStatusIcon(
  key: StatusIconKey,
  color: string,
  size: number,
  className = ""
): React.ReactElement {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
  };

  switch (key) {
    case "circle_dashed":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" strokeDasharray="2.5 2" fill="none" />
        </svg>
      );

    case "circle_empty":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
        </svg>
      );

    case "circle_dot":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <circle cx="8" cy="8" r="2" fill={color} />
        </svg>
      );

    case "circle_quarter":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 8 8 L 8 2 A 6 6 0 0 1 14 8 Z" fill={color} />
        </svg>
      );

    case "circle_half":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 8 8 L 8 2 A 6 6 0 0 1 14 8 A 6 6 0 0 1 8 14 Z" fill={color} />
        </svg>
      );

    case "circle_three_quarter":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 8 8 L 8 2 A 6 6 0 1 1 2 8 Z" fill={color} />
        </svg>
      );

    case "circle_full":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" fill={color} />
        </svg>
      );

    case "circle_check":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" fill={color} />
          <path d="M 5.5 8 L 7 9.5 L 10.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case "circle_x":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 6 6 L 10 10 M 10 6 L 6 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "circle_minus":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="5" y1="8" x2="11" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "circle_clock":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 8 5 L 8 8 L 10.5 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case "circle_arrow_up":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 8 11 L 8 5 M 5.5 7.5 L 8 5 L 10.5 7.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case "circle_arrows":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 5.5 6 A 3.5 3.5 0 1 1 4.8 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 4 8 L 4.8 9.5 L 6.3 8.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case "circle_pause":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="6.5" y1="5.5" x2="6.5" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9.5" y1="5.5" x2="9.5" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "circle_eye":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 5 8 Q 8 5.5 11 8 Q 8 10.5 5 8" stroke={color} strokeWidth="1.2" fill="none" />
          <circle cx="8" cy="8" r="1.5" fill={color} />
        </svg>
      );

    case "circle_flash":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 9 4.5 L 6.5 8.5 H 9 L 7 11.5 L 10.5 7 H 8 Z" fill={color} />
        </svg>
      );

    case "circle_flag":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 6 4.5 L 6 11.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 6 4.5 L 11 6.5 L 6 8.5 Z" fill={color} />
        </svg>
      );

    case "circle_star":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 8 5 L 9 7 L 11 7 L 9.5 8.5 L 10 11 L 8 9.5 L 6 11 L 6.5 8.5 L 5 7 L 7 7 Z" fill={color} />
        </svg>
      );

    case "circle_alert":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" fill={color} />
          <line x1="8" y1="5" x2="8" y2="9.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.8" fill="white" />
        </svg>
      );

    case "circle_question":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M 6.5 6.5 Q 6.5 5 8 5 Q 9.5 5 9.5 6.5 Q 9.5 8 8 8.5 L 8 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <circle cx="8" cy="11" r="0.8" fill={color} />
        </svg>
      );
  }
}
