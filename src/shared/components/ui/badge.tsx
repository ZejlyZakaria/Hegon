import { type ReactNode, type CSSProperties } from "react";
import { cn } from "@/shared/utils/utils";

// HEGON badge — ONE canonical chip form across every module. The FORM is fixed
// (radius, size, padding, weight) so a badge always reads as a HEGON badge; the
// COLOUR carries the meaning (category, status, priority…) via the `color` prop.
//   tint    — colour-tinted fill + hairline + coloured text (default; category/status)
//   solid   — filled with the colour, white text (loud labels)
//   outline — hairline + coloured text, no fill (quiet)
interface BadgeProps {
  /** Semantic colour — hex or CSS var. The badge derives fill/edge/text from it. */
  color?: string;
  variant?: "tint" | "solid" | "outline";
  uppercase?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({
  color = "var(--color-text-tertiary)",
  variant = "tint",
  uppercase = false,
  className,
  children,
}: BadgeProps) {
  const style: CSSProperties =
    variant === "solid"
      ? { backgroundColor: color, color: "#fff" }
      : variant === "outline"
        ? { color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` }
        : {
            color,
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, transparent)`,
          };

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-chip px-2 py-1 text-[10px] font-semibold leading-none",
        uppercase && "uppercase tracking-wider",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
