"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import SectionHeader from "@/shared/components/layout/SectionHeader";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";

const TABS = [
  { label: "Movies",   href: "/perso/watching/movies" },
  { label: "TV Shows", href: "/perso/watching/tv-shows" },
  { label: "Animes",   href: "/perso/watching/animes" },
  { label: "Library",  href: "/perso/watching/library" },
  { label: "Lists",    href: "/perso/watching/lists" },
  { label: "Stats",    href: "/perso/watching/stats" },
];

const TAB_HREFS = new Set(TABS.map((t) => t.href));

export default function WatchingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDetailOpen = useWatchingUIStore((s) => s.isDetailOpen);

  useEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [pathname]);
  const isDetail = isDetailOpen || (pathname.startsWith("/perso/watching/") && !TAB_HREFS.has(pathname));

  return (
    <div className="min-h-screen bg-zinc-950">
      {!isDetail && (
        <SectionHeader
          accent="var(--color-accent-watching-vivid)"
          tabs={TABS}
        />
      )}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
