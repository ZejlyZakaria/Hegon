"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";

export interface SectionTab {
  label: string;
  href: string;
}

export interface SectionStat {
  value: number | string;
  label: string;
}

export interface SectionHeaderProps {
  title?: string;
  subtitle?: string;
  accent: string;
  tabs: SectionTab[];
  /** Secondary tabs: inline on desktop, folded into a "More" dropdown on mobile. */
  moreTabs?: SectionTab[];
  stats?: SectionStat[];
}

function isTabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function TabLink({
  tab, accent, pathname, className,
}: {
  tab: SectionTab;
  accent: string;
  pathname: string;
  className?: string;
}) {
  const active = isTabActive(pathname, tab.href);
  return (
    <Link
      href={tab.href}
      className={cn(
        "relative shrink-0 whitespace-nowrap px-4 pb-2.5 pt-2 text-sm font-medium transition-colors",
        className,
      )}
      style={active ? { color: "var(--color-text-primary)" } : undefined}
    >
      <span className={!active ? "text-text-tertiary hover:text-text-secondary" : ""}>
        {tab.label}
      </span>
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
          style={{ backgroundColor: accent }}
        />
      )}
    </Link>
  );
}

// Mobile-only "More" dropdown for the secondary views.
function MoreMenu({ tabs, accent, pathname }: { tabs: SectionTab[]; accent: string; pathname: string }) {
  const activeTab = tabs.find((t) => isTabActive(pathname, t.href));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex shrink-0 items-center gap-1 whitespace-nowrap px-4 pb-2.5 pt-2 text-sm font-medium outline-none transition-colors lg:hidden",
            activeTab ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
          )}
        >
          {activeTab?.label ?? "More"}
          <ChevronDown size={14} />
          {activeTab && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
              style={{ backgroundColor: accent }}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36 bg-surface-3 border-border-strong">
        {tabs.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <DropdownMenuItem
              key={tab.href}
              asChild
              className={cn(
                "cursor-pointer text-sm focus:bg-surface-2 focus:text-text-primary",
                active ? "text-text-primary" : "text-text-secondary",
              )}
            >
              <Link href={tab.href}>{tab.label}</Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SectionHeader({ title, subtitle, accent, tabs, moreTabs, stats }: SectionHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="shrink-0">
      {/* Module header */}
      {(title || subtitle || (stats && stats.length > 0)) && (
      <div className="mb-4 flex items-start justify-between px-4 sm:px-6 pt-5">
        <div>
          {title && <h1 className="text-xl font-bold leading-tight text-text-primary">{title}</h1>}
          {subtitle && <p className="mt-0.5 text-sm text-text-tertiary">{subtitle}</p>}
        </div>
        {stats && stats.length > 0 && (
          <div className="flex items-center gap-2.5 mt-1">
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {i > 0 && <span className="text-text-tertiary/30 select-none">·</span>}
                <span className="text-xs text-text-tertiary">
                  <span className="font-semibold text-text-secondary">{stat.value}</span>
                  {" "}{stat.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Tabs — primary inline; secondary inline on desktop, "More" dropdown on mobile */}
      <div className="flex items-center border-b border-zinc-800 px-4 sm:px-6 overflow-x-auto custom-scrollbar-hide">
        {tabs.map((tab) => (
          <TabLink key={tab.href} tab={tab} accent={accent} pathname={pathname} />
        ))}
        {moreTabs?.map((tab) => (
          <TabLink key={tab.href} tab={tab} accent={accent} pathname={pathname} className="hidden lg:block" />
        ))}
        {moreTabs && moreTabs.length > 0 && (
          <MoreMenu tabs={moreTabs} accent={accent} pathname={pathname} />
        )}
      </div>
    </div>
  );
}
