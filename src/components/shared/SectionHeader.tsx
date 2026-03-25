// components/shared/SectionHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/utils";

// ─── types ────────────────────────────────────────────────────────────────────

export interface SectionTab {
  label: string;
  href: string;
}

export interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  accent: string;
  tabs: SectionTab[];
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function SectionHeader({
  icon,
  title,
  accent,
  tabs,
}: SectionHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-6 h-14">
          {/* section identity */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span style={{ color: accent }}>{icon}</span>
            <span className="text-sm font-bold text-white tracking-tight">
              {title}
            </span>
          </div>

          {/* divider */}
          <div className="w-px h-4 bg-zinc-700/60 shrink-0" />

          {/* tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const active =
                pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150",
                    active
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
                  )}
                >
                  {tab.label}
                  {/* active indicator */}
                  {active && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
