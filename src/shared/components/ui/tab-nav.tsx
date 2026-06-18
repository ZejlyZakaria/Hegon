"use client";

import { Fragment, useId, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";

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
// Underline tabs whose single indicator SLIDES between tabs (Framer layoutId).
// Overflow rule (mobile only): more than 4 tabs → show the first 3 + a "More"
// dropdown holding the rest; desktop always shows the full row.
export function TabNav({ items, activeKey, accent = "var(--color-accent-goals)", activeColor, className }: TabNavProps) {
  const groupId = useId();
  const reduce = useReducedMotion();

  const separator = <span className="mx-1.5 h-4 w-px shrink-0 self-center bg-border-subtle" />;

  const renderTab = (item: TabItem, gid: string) => {
    const active = item.key === activeKey;
    const cls = cn(
      "group relative shrink-0 cursor-pointer whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors",
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
            layoutId={`tabnav-${gid}`}
            className="absolute inset-x-1 bottom-0 h-1 rounded-t-lg"
            style={{ backgroundColor: accent }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
          />
        )}
      </>
    );
    return item.href ? (
      <Link href={item.href} className={cls} style={style}>{inner}</Link>
    ) : (
      <button type="button" onClick={item.onClick} className={cls} style={style}>{inner}</button>
    );
  };

  const fullRow = (gid: string) =>
    items.map((item) => (
      <Fragment key={item.key}>
        {item.separatorBefore && separator}
        {renderTab(item, gid)}
      </Fragment>
    ));

  // ≤4 tabs → one plain row (identical on every breakpoint).
  if (items.length <= 4) {
    return (
      <div className={cn("flex items-center overflow-x-auto overflow-y-hidden custom-scrollbar-hide", className)}>
        {fullRow(groupId)}
      </div>
    );
  }

  // >4 tabs → desktop shows all; mobile shows the first 3 + a "More" dropdown.
  const visible = items.slice(0, 3);
  const hidden = items.slice(3);
  const activeHidden = hidden.find((i) => i.key === activeKey);

  return (
    <div className={cn("flex items-center", className)}>
      {/* Desktop — full row */}
      <div className="hidden items-center overflow-x-auto overflow-y-hidden custom-scrollbar-hide sm:flex">
        {fullRow(groupId)}
      </div>

      {/* Mobile — first 3 + More */}
      <div className="flex items-center sm:hidden">
        {visible.map((item) => (
          <Fragment key={item.key}>
            {item.separatorBefore && separator}
            {renderTab(item, `${groupId}-m`)}
          </Fragment>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors",
                activeHidden ? "" : "text-text-secondary hover:bg-surface-1 hover:text-text-primary",
              )}
              style={activeHidden ? { color: activeColor ?? accent } : undefined}
            >
              {activeHidden ? activeHidden.label : "More"}
              <ChevronDown size={14} />
              {activeHidden && (
                <span className="absolute inset-x-1 bottom-0 h-1 rounded-t-lg" style={{ backgroundColor: accent }} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {hidden.map((item) => {
              const active = item.key === activeKey;
              const itemStyle = active ? { color: activeColor ?? accent } : undefined;
              const content = (
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
              );
              return item.href ? (
                <DropdownMenuItem key={item.key} asChild className="cursor-pointer text-sm" style={itemStyle}>
                  <Link href={item.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={item.key}
                  className="cursor-pointer text-sm"
                  style={itemStyle}
                  onSelect={() => item.onClick?.()}
                >
                  {content}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
