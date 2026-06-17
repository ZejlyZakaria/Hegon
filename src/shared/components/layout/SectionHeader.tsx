"use client";

import { usePathname } from "next/navigation";
import { TabNav } from "@/shared/components/ui/tab-nav";

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
  /** Secondary tabs — appended to the same scrollable tab bar. */
  moreTabs?: SectionTab[];
  stats?: SectionStat[];
  /** Active label colour — defaults to the accent (white for neutral modules). */
  activeColor?: string;
}

function isTabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SectionHeader({ title, subtitle, accent, tabs, moreTabs, stats, activeColor }: SectionHeaderProps) {
  const pathname = usePathname();
  const allTabs = [...tabs, ...(moreTabs ?? [])];

  // Most-specific matching href wins, so a nested/detail route keeps its parent tab active.
  const activeKey =
    allTabs
      .filter((t) => isTabActive(pathname, t.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";

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

      {/* Tab bar — the shared TabNav on a full-width rail */}
      <div className="border-b border-border-subtle px-4 sm:px-6">
        <TabNav
          accent={accent}
          activeColor={activeColor}
          activeKey={activeKey}
          items={allTabs.map((t) => ({ key: t.href, label: t.label, href: t.href }))}
        />
      </div>
    </div>
  );
}
