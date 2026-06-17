"use client";

import { Fragment, useId, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/shared/utils/utils";

export interface TabItem {
  key:      string;
  label:    ReactNode;
  href?:    string;        // route tab → renders a <Link>
  onClick?: () => void;    // state tab → renders a <button>
  icon?:    ReactNode;
  /** Draw a thin vertical divider before this tab (e.g. filters | destinations). */
  separatorBefore?: boolean;
}

interface TabNavProps {
  items:     TabItem[];
  activeKey: string;
  /** Active indicator (underline) colour — pass the module accent. */
  accent?:   string;
  /** Active label colour — defaults to `accent`. Neutral-identity modules (Tasks,
   *  whose accent is grey) pass white here so the active tab stays legible. */
  activeColor?: string;
  className?: string;
}

// HEGON primary navigation tabs — ONE canonical bar across every module.
// Underline tabs whose single indicator SLIDES between tabs (Framer layoutId,
// the premium signature). Items are route links or state buttons; the parent
// supplies the baseline rail (border-b) so the indicator sits on it.
export function TabNav({ items, activeKey, accent = "var(--color-accent-goals)", activeColor, className }: TabNavProps) {
  const groupId = useId();
  const reduce = useReducedMotion();

  return (
    <div className={cn("flex items-center overflow-x-auto custom-scrollbar-hide", className)}>
      {items.map((item) => {
        const active = item.key === activeKey;
        const cls = cn(
          "group relative shrink-0 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors",
          active ? "" : "text-text-secondary hover:bg-surface-1 hover:text-text-primary",
        );
        const style = active ? { color: activeColor ?? accent } : undefined;
        const inner = (
          <>
            <span className="flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
            {active && (
              <motion.span
                layoutId={`tabnav-${groupId}`}
                className="absolute inset-x-1 -bottom-px h-1 rounded-t-lg"
                style={{ backgroundColor: accent }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
          </>
        );
        const el = item.href ? (
          <Link href={item.href} className={cls} style={style}>{inner}</Link>
        ) : (
          <button type="button" onClick={item.onClick} className={cls} style={style}>{inner}</button>
        );
        return (
          <Fragment key={item.key}>
            {item.separatorBefore && <span className="mx-1.5 h-4 w-px shrink-0 self-center bg-border-subtle" />}
            {el}
          </Fragment>
        );
      })}
    </div>
  );
}
