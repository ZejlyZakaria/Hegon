"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionTab {
  label: string;
  href: string;
}

export interface SectionHeaderProps {
  title: string;
  subtitle: string;
  accent: string;
  tabs: SectionTab[];
}

export default function SectionHeader({ title, subtitle, accent, tabs }: SectionHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="px-6 pt-5 pb-0 shrink-0">
      {/* Module header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold leading-tight text-text-primary">{title}</h1>
        <p className="mt-0.5 text-sm text-text-tertiary">{subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative px-4 pb-2.5 pt-1 text-sm font-medium transition-colors"
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
        })}
      </div>
    </div>
  );
}
