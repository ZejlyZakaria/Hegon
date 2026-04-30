// app/perso/watching/layout.tsx
import SectionHeader from "@/shared/components/layout/SectionHeader";

const TABS = [
  { label: "Movies",   href: "/perso/watching/movies" },
  { label: "TV Shows", href: "/perso/watching/tv-shows" },
  { label: "Animes",   href: "/perso/watching/animes" },
  { label: "Library",  href: "/perso/watching/library" },
];

export default function WatchingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <SectionHeader
        title="Watching"
        subtitle="Movies, series, animes — everything you watch, tracked."
        accent="#8b5cf6"
        tabs={TABS}
      />
      <div>{children}</div>
    </div>
  );
}