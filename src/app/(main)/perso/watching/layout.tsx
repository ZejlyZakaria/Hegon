"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import SectionHeader from "@/shared/components/layout/SectionHeader";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import { ThemePlayer } from "@/modules/watching/components/ThemePlayer";
import { WatchingSearch } from "@/modules/watching/components/shared/WatchingSearch";

// Primary = content types (always inline); More = views (dropdown on mobile).
const TABS = [
  { label: "Movies",   href: "/perso/watching/movies" },
  { label: "TV Shows", href: "/perso/watching/tv-shows" },
  { label: "Animes",   href: "/perso/watching/animes" },
];

const MORE_TABS = [
  { label: "Library",  href: "/perso/watching/library" },
  { label: "Lists",    href: "/perso/watching/lists" },
  { label: "Stats",    href: "/perso/watching/stats" },
];

const TAB_HREFS = new Set([...TABS, ...MORE_TABS].map((t) => t.href));

export default function WatchingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDetailOpen = useWatchingUIStore((s) => s.isDetailOpen);

  useEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [pathname]);
  const isDetail = isDetailOpen || (pathname.startsWith("/perso/watching/") && !TAB_HREFS.has(pathname));

  return (
    <div className="min-h-screen bg-surface-0">
      {!isDetail && (
        <SectionHeader
          accent="var(--color-accent-watching-vivid)"
          tabs={TABS}
          moreTabs={MORE_TABS}
          actions={<WatchingSearch />}
        />
      )}
      {/**
       * NO ENTRANCE ANIMATION, AND NO `key={pathname}` — removed 21/07 on the owner's call.
       *
       * The key forced React to destroy and rebuild the ENTIRE subtree on every tab change, then
       * replay a 220ms fade over the whole page. That is what "it feels like a full reload" was: not
       * a reload, a rebuild plus a fade, on a navigation that was already instant from cache.
       *
       * The fade hid nothing — there is no load to cover — so it was 220ms of loading theatre added
       * to every click. An interface that redraws itself completely to move between two tabs is the
       * same family of fault as one that changes its mind about a value.
       */}
      {children}

      {/* Global OP/ED player — persists across Watching pages (Watching-only). */}
      <ThemePlayer />
    </div>
  );
}
