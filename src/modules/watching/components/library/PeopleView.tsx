"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Users } from "lucide-react";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Button } from "@/shared/components/ui/button";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { Hint } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/utils";
import { PersonFace } from "@/modules/watching/components/shared/PersonFace";
import { AddMark } from "@/modules/watching/components/shared/AddMark";
import { FollowMark } from "@/modules/watching/components/shared/FollowMark";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { WatchlistMark } from "@/modules/watching/components/shared/Marks";
import { PEOPLE_PAGE, useFollowsPages, usePeopleRanking, useUpcomingPages } from "@/modules/watching/hooks/useFollows";
import { useOwnedTitles } from "@/modules/watching/hooks/useAwards";
import { indexOwned, posterUrl, workKey } from "@/modules/watching/lib/awards";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import type { PersonUpcomingRow, RankingKind } from "@/modules/watching/types";

/**
 * LIBRARY › PEOPLE — the people side of what is yours (owner, 2026-09-16, §11).
 *
 * Not a tab of its own: Library is "what is mine", titles AND people, and a person crosses films
 * and series so she can live under neither Movies nor TV Shows. Rails, in the order you use them:
 * who you FOLLOW (the ✓ on the rim takes them off), what is COMING from them (the robot's table
 * joined to your follows — a poster, the date, who), and who you have watched MOST (ranked in SQL,
 * `people_ranking`) — so the view has something to say before your first follow, and that is where
 * you find whom to follow.
 *
 * Every rail is ONE ROW, paged (owner): at most 20 items, prev / next by a page, and "See more"
 * opens the list in a sliding panel that grows 50 at a time — each page a database call, never a
 * thousand directors in one payload (owner, 2026-09-17).
 */

const DEPT_LABEL: Record<string, string> = { Acting: "Actor", Directing: "Director", Writing: "Writer", Production: "Producer" };
const RAIL_MAX = 20;
const GAP = 16;
function perView(w: number) { return w < 640 ? 4 : w < 768 ? 6 : w < 1280 ? 8 : 10; }

interface Person { id: number; name: string; src: string | null; subtitle: string | null; knownFor: string | null }
interface UpcomingGroup { row: PersonUpcomingRow; people: { name: string; role: string }[] }
interface Owned { id: string; want: boolean; level: "high" | "medium" | "low" | null }
/** What a paged list hands the rail: what is loaded, whether there is more, and how to get it. */
interface Paged<T> { items: T[]; hasMore: boolean; loadingMore: boolean; more: () => void; loading: boolean }

function dateLabel(iso: string | null): string {
  if (!iso) return "Date TBA";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const today = () => new Date().toISOString().slice(0, 10);

/** The number of items one page shows at this width — shared by every rail so they page alike. */
function usePerView() {
  const [n, setN] = useState(10);
  useEffect(() => {
    const onResize = () => setN(perView(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return n;
}

/**
 * ONE PAGED ROW + ITS "SEE MORE" PANEL. The rail shows the first 20 of what is loaded and pages by
 * what fits; the panel lists everything loaded as rows and asks the database for 50 more at the
 * bottom. Faces and posters both go through here.
 */
function PagedRail<T>({ title, icon, paged, keyOf, renderTile, renderRow }: {
  title: React.ReactNode;
  icon: React.ReactNode;
  paged: Paged<T>;
  keyOf: (item: T) => string;
  renderTile: (item: T) => React.ReactNode;
  renderRow: (item: T) => React.ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const n = usePerView();
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const shown = paged.items.slice(0, RAIL_MAX);
  const pages = Math.max(1, Math.ceil(shown.length / n));
  const current = Math.min(page, pages - 1);
  const style = { width: `calc((100% - ${(n - 1) * GAP}px) / ${n})` };
  const go = (to: number) => {
    const el = railRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(pages - 1, to));
    setPage(next);
    el.scrollTo({ left: next * (el.clientWidth + GAP), behavior: "smooth" });
  };

  return (
    <section>
      <SectionHeader
        title={title}
        actions={
          <>
            {pages > 1 && <CarouselNav className="hidden lg:flex" onPrev={() => go(current - 1)} onNext={() => go(current + 1)} canPrev={current > 0} canNext={current < pages - 1} />}
            {(paged.items.length > n || paged.hasMore) && <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>See more</Button>}
          </>
        }
      />
      <div ref={railRef} className="flex snap-x gap-4 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
        {shown.map((item) => <div key={keyOf(item)} className="shrink-0 snap-start" style={style}>{renderTile(item)}</div>)}
      </div>

      <SlidingPanel open={open} onClose={() => setOpen(false)} icon={icon} title={<span className="text-sm font-semibold text-text-primary">{title}</span>}>
        <div className="px-2 py-3">
          {paged.items.map((item) => <div key={keyOf(item)}>{renderRow(item)}</div>)}
          {paged.hasMore && (
            <div className="px-2 pt-1">
              {/* The achievements panel's own control: text in the flow, not button chrome. */}
              <button
                type="button"
                onClick={paged.more}
                disabled={paged.loadingMore}
                className="rounded-control px-2 py-1 text-micro font-medium text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-60"
              >
                {paged.loadingMore ? "Loading…" : `Load more · ${PEOPLE_PAGE} at a time`}
              </button>
            </div>
          )}
        </div>
      </SlidingPanel>
    </section>
  );
}

/** A person as a ROW — the sliding panel's line: a big face, the name, one word, the follow mark. */
function PersonRow({ p }: { p: Person }) {
  return (
    <div className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-2">
      <Link href={`/perso/watching/person/${p.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border-subtle">
          {p.src && <Image src={tmdbImageFor(p.src, 56) || p.src} alt={p.name} fill sizes="56px" loading="lazy" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary transition-colors group-hover:text-accent-watching-vivid">{p.name}</p>
          {p.subtitle && <p className="truncate text-micro text-text-tertiary">{p.subtitle}</p>}
        </div>
      </Link>
      <FollowMark personId={p.id} name={p.name} profileUrl={p.src} knownFor={p.knownFor} className="shrink-0" />
    </div>
  );
}

function PeopleRail({ title, paged }: { title: React.ReactNode; paged: Paged<Person> }) {
  return (
    <PagedRail
      title={title}
      icon={<Users size={15} className="text-accent-watching-vivid" />}
      paged={paged}
      keyOf={(p) => String(p.id)}
      renderTile={(p) => <PersonFace id={p.id} name={p.name} src={p.src} subtitle={p.subtitle} knownFor={p.knownFor} />}
      renderRow={(p) => <PersonRow p={p} />}
    />
  );
}

/** "Brad Pitt · as Cliff Booth", one line per person — the tooltip of a title several of them share. */
function peopleLabel(people: UpcomingGroup["people"]) {
  return <div className="space-y-0.5">{people.map((p) => <p key={p.name}>{p.name} · {p.role}</p>)}</div>;
}

function UpcomingTile({ group, owned }: { group: UpcomingGroup; owned: Owned | null }) {
  const router = useRouter();
  const { row, people } = group;
  const type = row.media_type === "movie" ? "film" : "serie";
  const href = owned ? `/perso/watching/${owned.id}` : `/perso/watching/discover/${type}/${row.tmdb_id}`;
  const out = !!row.release_date && row.release_date <= today();
  const tile = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      className="group block w-full cursor-pointer text-left"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-tile bg-surface-2 transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
        {row.poster_path ? (
          <Image src={tmdbImageFor(posterUrl(row.poster_path), 200) || "/placeholder.svg"} alt={row.title} fill loading="lazy" sizes="(max-width: 768px) 33vw, 200px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-micro text-text-tertiary">{row.title}</div>
        )}
        {/* On your watchlist (or waiting for it) → the bookmark, as on every other poster. */}
        {owned?.want && (
          <div className="absolute left-2 top-0 z-10">
            <WatchlistMark level={owned.level} />
          </div>
        )}
        {!owned && <AddMark tmdbId={row.tmdb_id} type={type} title={row.title} />}
      </div>
      <p className="mt-2 truncate text-xs font-medium text-text-primary">{row.title}</p>
      <p className={cn("truncate text-micro tabular-nums", out ? "text-accent-watching-vivid" : "text-text-tertiary")}>{out ? "Out now" : dateLabel(row.release_date)}</p>
      {/* One person: name and part. Several: their surnames — three lines whatever happens, so the
          row of tiles stays level; the parts live in the tooltip. */}
      <p className="truncate text-micro text-text-tertiary">
        {people.length === 1 ? `${people[0].name} · ${people[0].role}` : people.map((p) => p.name.split(" ").slice(-1)[0]).join(", ")}
      </p>
    </div>
  );
  return people.length > 1 ? <Hint label={peopleLabel(people)}>{tile}</Hint> : tile;
}

function UpcomingRow({ group, owned }: { group: UpcomingGroup; owned: Owned | null }) {
  const { row, people } = group;
  const type = row.media_type === "movie" ? "film" : "serie";
  const out = !!row.release_date && row.release_date <= today();
  return (
    <MediaRow
      href={owned ? `/perso/watching/${owned.id}` : `/perso/watching/discover/${type}/${row.tmdb_id}`}
      posterUrl={posterUrl(row.poster_path)}
      title={row.title}
      meta={
        <span className="truncate text-micro text-text-tertiary">
          <span className={cn("tabular-nums", out && "text-accent-watching-vivid")}>{out ? "Out now" : dateLabel(row.release_date)}</span>
          {" · "}{people.map((p) => `${p.name} · ${p.role}`).join(" · ")}
        </span>
      }
      right={owned?.want ? <WatchlistMark level={owned.level} size="row" className="mr-1.5" /> : undefined}
    />
  );
}

const roleOf = (r: PersonUpcomingRow) => (r.department === "Acting" ? (r.role ? `as ${r.role}` : "Cast") : r.role ?? DEPT_LABEL[r.department] ?? r.department);

/** The shape a PagedRail reads from an infinite query. */
function paged<T, R>(q: { data?: { pages: R[][] }; hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown; isLoading: boolean }, map: (r: R) => T): Paged<T> {
  return {
    items: (q.data?.pages ?? []).flat().map(map),
    hasMore: q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    more: () => { void q.fetchNextPage(); },
    loading: q.isLoading,
  };
}

function RankingRail({ title, kind }: { title: string; kind: RankingKind }) {
  const q = usePeopleRanking(kind);
  const department = kind === "directing" ? "Directing" : "Acting";
  // Cheap enough to derive on every render (a few hundred rows at most) — no memo to keep honest.
  const list = paged(q, (r) => ({ id: r.id, name: r.name, src: r.profile_url, subtitle: `${r.n} ${r.n === 1 ? "title" : "titles"}`, knownFor: department }));
  if (list.loading) return <PeopleSkeletonRail title={title} />;
  if (list.items.length < 2) return null;
  return <PeopleRail title={title} paged={list} />;
}

export function PeopleView({ userId }: { userId: string }) {
  const followsQ = useFollowsPages(userId);
  const upcomingQ = useUpcomingPages(userId);
  const ownedQ = useOwnedTitles(userId);
  const owned = useMemo(() => indexOwned(ownedQ.data ?? []), [ownedQ.data]);
  const following = paged(followsQ, (f) => ({ id: f.person_tmdb_id, name: f.name, src: f.profile_url, subtitle: DEPT_LABEL[f.known_for ?? ""] ?? f.known_for ?? null, knownFor: f.known_for }));
  const nameOf = new Map(following.items.map((p) => [p.id, p.name]));
  // One tile per title: three people you follow on one film are one film, with three names. Rows
  // arrive 50 at a time; a title split across two pages simply gains its other names on the next.
  const upcoming: Paged<UpcomingGroup> = (() => {
    const by = new Map<string, UpcomingGroup>();
    for (const r of (upcomingQ.data?.pages ?? []).flat()) {
      const k = `${r.media_type}:${r.tmdb_id}`;
      const g = by.get(k) ?? { row: r, people: [] };
      g.people.push({ name: nameOf.get(r.person_tmdb_id) ?? "", role: roleOf(r) });
      by.set(k, g);
    }
    return {
      items: [...by.values()].sort((a, b) => (a.row.release_date ?? "9999").localeCompare(b.row.release_date ?? "9999")),
      hasMore: upcomingQ.hasNextPage, loadingMore: upcomingQ.isFetchingNextPage, more: () => { void upcomingQ.fetchNextPage(); }, loading: upcomingQ.isLoading,
    };
  })();
  const ownedOf = (g: UpcomingGroup): Owned | null => {
    const o = owned.get(workKey(g.row.media_type === "movie" ? "film" : "serie", g.row.tmdb_id));
    return o ? { id: o.id, want: !!o.want_to_watch, level: o.priority_level ?? null } : null;
  };

  return (
    <div className="space-y-8">
      {following.loading ? (
        <PeopleSkeletonRail title="Following" />
      ) : following.items.length === 0 ? (
        <section>
          <SectionHeader title="Following" />
          <div className="rounded-card border border-border-subtle bg-surface-1 p-5 text-sm text-text-secondary">
            You follow no one yet. The <span className="font-semibold text-text-primary">+</span> on a face — in a title&apos;s Cast &amp; Crew, or on a person&apos;s page — adds them here, and their upcoming work shows up below.
          </div>
        </section>
      ) : (
        <PeopleRail title={<>Following <span className="text-text-tertiary">({following.items.length}{following.hasMore ? "+" : ""})</span></>} paged={following} />
      )}

      {following.items.length > 0 && (
        upcoming.loading ? (
          <PosterSkeletonRail title="Upcoming from people you follow" />
        ) : upcoming.items.length === 0 ? (
          <section>
            <SectionHeader title="Upcoming from people you follow" />
            <p className="py-4 text-xs text-text-tertiary">Nothing dated on their slates right now — the robot checks every week, and right after a follow.</p>
          </section>
        ) : (
          <PagedRail
            title={<>Upcoming from people you follow <span className="text-text-tertiary">({upcoming.items.length}{upcoming.hasMore ? "+" : ""})</span></>}
            icon={<CalendarClock size={15} className="text-accent-watching-vivid" />}
            paged={upcoming}
            keyOf={(g) => `${g.row.media_type}:${g.row.tmdb_id}`}
            renderTile={(g) => <UpcomingTile group={g} owned={ownedOf(g)} />}
            renderRow={(g) => <UpcomingRow group={g} owned={ownedOf(g)} />}
          />
        )
      )}

      <RankingRail title="Your most watched actors" kind="actors" />
      <RankingRail title="Your most watched voice actors" kind="voice" />
      <RankingRail title="Your most watched directors" kind="directing" />
    </div>
  );
}

// ── Skeletons — the exact shape of the rails above, at every width ──────────────────────────
// Ten cells like the rail at desktop, and the same breakpoints hide the extra ones below: 4 on a
// phone, 6 on a small tablet, 8 on a large one — so the pulse never shows a count the real rail
// cannot. The header pulses stand in for the prev / next / See more controls.

const CELL = "shrink-0 [&:nth-child(n+5)]:hidden sm:[&:nth-child(n+5)]:block sm:[&:nth-child(n+7)]:hidden lg:[&:nth-child(n+7)]:block lg:[&:nth-child(n+9)]:hidden xl:[&:nth-child(n+9)]:block";
const CELL_W = "w-[calc((100%-3*16px)/4)] sm:w-[calc((100%-5*16px)/6)] lg:w-[calc((100%-7*16px)/8)] xl:w-[calc((100%-9*16px)/10)]";

function SkeletonHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-title text-text-primary">{title}</h3>
      <div className="hidden items-center gap-1.5 lg:flex">
        <div className="h-8 w-8 animate-pulse rounded-control bg-surface-2" />
        <div className="h-8 w-8 animate-pulse rounded-control bg-surface-2" />
        <div className="ml-1 h-8 w-20 animate-pulse rounded-control bg-surface-2" />
      </div>
    </div>
  );
}

/** One row of pulsing faces — a people rail while its page is in flight. */
export function PeopleSkeletonRail({ title }: { title: string }) {
  return (
    <section aria-hidden>
      <SkeletonHeader title={title} />
      <div className="flex gap-4 py-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={cn(CELL, CELL_W, "flex flex-col items-center")}>
            <div className="aspect-square w-full animate-pulse rounded-full bg-surface-2" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded-control bg-surface-2" />
            <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded-control bg-surface-2" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** One row of pulsing posters — the Upcoming rail while its page is in flight. */
function PosterSkeletonRail({ title }: { title: string }) {
  return (
    <section aria-hidden>
      <SkeletonHeader title={title} />
      <div className="flex gap-4 py-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={cn(CELL, CELL_W)}>
            <div className="aspect-2/3 w-full animate-pulse rounded-tile bg-surface-2" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded-control bg-surface-2" />
            <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-control bg-surface-2" />
            <div className="mt-1.5 h-2.5 w-3/5 animate-pulse rounded-control bg-surface-2" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The whole view — the route's loading state when the URL says `?view=people`. */
export function PeopleViewSkeleton() {
  return (
    <div className="space-y-8">
      <PeopleSkeletonRail title="Following" />
      <PosterSkeletonRail title="Upcoming from people you follow" />
      <PeopleSkeletonRail title="Your most watched actors" />
    </div>
  );
}
