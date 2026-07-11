"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarClock, Plus, Star } from "lucide-react";
import { SearchInput } from "@/shared/components/ui/search-input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { posterStatus, PosterStatusBadge } from "@/modules/watching/components/shared/StatusBadge";
import { Button } from "@/shared/components/ui/button";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { usePeopleCounts, usePersonBundle, useTitlesByPerson } from "@/modules/watching/hooks/usePerson";
import { PersonHero } from "@/modules/watching/components/person/PersonHero";
import { PersonJourney } from "@/modules/watching/components/person/PersonJourney";
import { PersonSkeleton } from "@/modules/watching/components/person/PersonSkeleton";
import { SeenTogether } from "@/modules/watching/components/person/SeenTogether";
import { PersonInsights, type PersonInsightsData } from "@/modules/watching/components/person/PersonInsights";
import { PersonTimelinePanel, datedCount } from "@/modules/watching/components/person/PersonTimelinePanel";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { PersonCredit, PersonTitle } from "@/modules/watching/service";

const DEPT_LABEL: Record<string, string> = {
  Acting: "Actor", Directing: "Director", Writing: "Writer", Production: "Producer",
};
const AMBER = "#fbbf24";
// Our stored urls are full (w342) — strip back to the raw TMDB path the modal expects.
const stripSize = (u: string | null) => (u ? u.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, "") : null);

// The toolbar only earns its place once the grid is big enough to need it.
const TOOLBAR_MIN = 5;
const TIMELINE_MIN = 4;   // dated titles — fewer than that tells no story

type SortKey = "rating" | "watched" | "released";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "Your rating" },
  { value: "watched", label: "Watch date" },
  { value: "released", label: "Release date" },
];

// Status is the spine of the grid — it never hides anything, it orders it. The sort
// select only reorders WITHIN each status group, so the structure never disappears.
const STATUS_RANK = (t: PersonTitle) =>
  t.watched ? 0 : t.in_progress ? 1 : t.want_to_watch ? 2 : t.paused ? 3 : t.dropped ? 4 : 5;

// Missing values always sink to the bottom of their group, whatever the sort.
function sortValue(t: PersonTitle, key: SortKey): number {
  if (key === "rating") return t.user_rating ?? -1;
  if (key === "released") return t.year ?? -1;
  return t.watched_at ? new Date(t.watched_at).getTime() : -1;
}

export default function PersonPage() {
  const params = useParams<{ id: string }>();
  const personId = Number(params.id);
  const router = useRouter();
  const userId = useCurrentUserId();

  const { data: bundle, isLoading } = usePersonBundle(personId);
  const creditTmdbIds = bundle ? bundle.credits.map((c) => c.tmdb_id) : [];
  const { data: rawTitles = [], isFetched: titlesFetched } = useTitlesByPerson(userId ?? "", personId, creditTmdbIds);
  const { data: peopleCounts, isFetched: countsFetched } = usePeopleCounts(userId ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [addItem, setAddItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(18);
  const [sort, setSort] = useState<SortKey>("rating");
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Hold the skeleton until BOTH halves are in. The TMDB filmography lands first; if we
  // painted then, "Not seen yet" would render alone and get shoved down when your titles
  // arrive. A section appears once, in its place.
  const waitingForTitles = !!userId && creditTmdbIds.length > 0 && !titlesFetched;
  if (isLoading || !bundle || waitingForTitles) return <PersonSkeleton />;

  const { profile, credits } = bundle;
  const roleLabel = DEPT_LABEL[profile.known_for_department ?? ""] ?? profile.known_for_department ?? "Person";
  const firstName = profile.name.split(" ")[0];

  // Match library ↔ credit by (kind, tmdb_id): film→movie, serie & anime→tv (anime is a
  // HEGON subtype of tv). Attach the person's role (character / job) from the credit.
  const kind = (t: string) => (t === "film" ? "movie" : "tv");
  const creditByKey = new Map(credits.map((c) => [`${kind(c.type)}:${c.tmdb_id}`, c] as const));
  const yourTitles = rawTitles
    .filter((t) => creditByKey.has(`${kind(t.type)}:${t.tmdb_id}`))
    .map((t) => ({ ...t, role: creditByKey.get(`${kind(t.type)}:${t.tmdb_id}`)?.role ?? null }));

  const sortedTitles = [...yourTitles].sort(
    (a, b) => STATUS_RANK(a) - STATUS_RANK(b) || sortValue(b, sort) - sortValue(a, sort),
  );

  // ── Your relationship with this person ──
  const owned = yourTitles.length;
  const total = credits.length;
  const watched = yourTitles.filter((t) => t.watched);
  const rated = yourTitles.filter((t) => t.user_rating != null);
  const avgRating = rated.length ? rated.reduce((s, t) => s + (t.user_rating ?? 0), 0) / rated.length : null;
  const top = rated.length ? rated.reduce((a, b) => ((b.user_rating ?? 0) > (a.user_rating ?? 0) ? b : a)) : null;

  const ownedKeys = new Set(yourTitles.map((t) => `${kind(t.type)}:${t.tmdb_id}`));
  const notSeen = credits.filter((c) => !ownedKeys.has(`${kind(c.type)}:${c.tmdb_id}`));
  const q = search.trim().toLowerCase();
  const filteredNotSeen = q ? notSeen.filter((c) => c.title.toLowerCase().includes(q)) : notSeen;
  const visibleNotSeen = filteredNotSeen.slice(0, visibleCount);

  // Signature canvas: your top-rated title's backdrop → most recognizable + personal.
  const backdrop =
    top?.backdrop_url ??
    yourTitles.find((t) => t.backdrop_url)?.backdrop_url ??
    credits.find((c) => c.backdrop_url)?.backdrop_url ??
    null;

  const journey = {
    owned, total, watchedCount: watched.length, avgRating,
    // Top 10 = a priority rank (one Top 10 per type), NOT the favorite heart.
    topTen: yourTitles.filter((t) => t.priority != null).length,
  };

  // ── Your [name]: rank in your library + the two titles that define your relationship ──
  const isDirector = profile.known_for_department === "Directing";
  const bucket = (isDirector ? peopleCounts?.directing : peopleCounts?.acting) ?? {};
  // A ranking has to measure everyone with the SAME ruler, so it reads the cast_members
  // index for this person too — not their (richer) credits ∩ library count. Mixing the two
  // made Brad #1-alone on his page but tied on Samuel's. The grid above still uses the
  // richer match; the rank is a relative statement and consistency beats precision here.
  const myCount = bucket[personId]?.n ?? 0;
  const others = Object.entries(bucket)
    .filter(([id]) => Number(id) !== personId)
    .map(([, p]) => p);
  const rank =
    countsFetched && myCount >= 2
      ? {
          position: 1 + others.filter((p) => p.n > myCount).length,
          noun: isDirector ? "director" : "actor",
          // A rank you share is only honest if it says with whom.
          tiedWith: others.filter((p) => p.n === myCount).map((p) => p.name).sort(),
        }
      : null;

  // Where you and the world disagree most, in your favour. Your #1 is excluded — it's the
  // cell right next to it, and repeating it would say nothing new.
  const gem = watched
    .filter((t) => t.user_rating != null && t.id !== top?.id)
    .map((t) => {
      const world = creditByKey.get(`${kind(t.type)}:${t.tmdb_id}`)?.vote ?? 0;
      return { t, world, delta: (t.user_rating ?? 0) - world };
    })
    .filter((g) => g.world > 0 && g.delta >= 0.5)
    .sort((a, b) => b.delta - a.delta)[0];

  const insights: PersonInsightsData = {
    rank,
    best: top
      ? { id: top.id, title: top.title, poster_url: top.poster_url, rating: top.user_rating!, meta: top.year ? String(top.year) : "" }
      : null,
    hiddenGem: gem
      ? {
          id: gem.t.id, title: gem.t.title, poster_url: gem.t.poster_url, rating: gem.t.user_rating!,
          meta: gem.world.toFixed(1), metaLogo: "/logo/watching_rating/Tmdb.svg",
        }
      : null,
  };

  const showToolbar = yourTitles.length >= TOOLBAR_MIN;
  const showTimeline = datedCount(yourTitles) >= TIMELINE_MIN;

  const openAdd = (c: PersonCredit) =>
    setAddItem({
      id: c.tmdb_id,
      title: c.title,
      name: c.title,
      poster_path: stripSize(c.poster_url),
      backdrop_path: stripSize(c.backdrop_url),
      vote_average: c.vote,
      overview: "",
      genre_ids: [],
      media_type: c.type === "film" ? "movie" : "tv",
      ...(c.type === "film"
        ? { release_date: c.year ? `${c.year}-01-01` : null }
        : { first_air_date: c.year ? `${c.year}-01-01` : null }),
    });

  return (
    <div className="min-h-screen bg-surface-0">
      <PersonHero profile={profile} roleLabel={roleLabel} backdrop={backdrop} onBack={() => router.back()} />

      {/* Mobile: the branded card right after the hero */}
      <div className="px-4 pt-4 lg:hidden">
        <PersonJourney stats={journey} />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">
        {/* ── LEFT — your memory, then discovery ── */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">
          {yourTitles.length > 0 && (
            <section>
              <SectionHeader
                title={`Your titles with ${firstName}`}
                actions={
                  showToolbar ? (
                    <>
                      {showTimeline && (
                        <Button variant="quiet" size="sm" onClick={() => setTimelineOpen(true)}>
                          <CalendarClock />
                          Timeline
                        </Button>
                      )}
                      <FilterSelect
                        size="sm"
                        className="w-36"
                        value={sort}
                        onChange={setSort}
                        options={SORT_OPTIONS}
                        aria-label="Sort your titles"
                      />
                    </>
                  ) : null
                }
              />

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {sortedTitles.map((t) => {
                  const badge = posterStatus(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => router.push(`/perso/watching/${t.id}`)}
                      className="group block w-full text-left"
                    >
                      <div className="relative aspect-2/3 overflow-hidden rounded-tile border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
                        <Image src={t.poster_url || "/placeholder.svg"} alt={t.title} fill unoptimized sizes="15vw" className="object-cover" />
                        {t.user_rating != null && (
                          <div className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">
                            <Star size={9} style={{ color: AMBER, fill: AMBER }} /> {t.user_rating}
                          </div>
                        )}
                        {badge && <PosterStatusBadge status={badge} />}
                      </div>
                      <p className="mt-2 truncate text-xs font-medium text-text-primary">{t.title}</p>
                      {t.role && <p className="truncate text-[11px] text-text-tertiary">{t.role}</p>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {notSeen.length > 0 && (
            <section>
              <SectionHeader
                title={<>Not seen yet <span className="text-text-tertiary">({notSeen.length})</span></>}
                actions={
                  <SearchInput
                    containerClassName="w-full sm:w-60"
                    placeholder="Search their films…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setVisibleCount(18); }}
                    onClear={() => { setSearch(""); setVisibleCount(18); }}
                  />
                }
              />

              {filteredNotSeen.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-tertiary">No match.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {visibleNotSeen.map((c) => (
                      <button key={c.tmdb_id} type="button" onClick={() => openAdd(c)} className="group block w-full text-left">
                        <div className="relative aspect-2/3 overflow-hidden rounded-tile border border-border-subtle transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
                          <Image src={c.poster_url || "/placeholder.svg"} alt={c.title} fill unoptimized loading="lazy" sizes="15vw" className="object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/25 group-hover:opacity-100">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/20 backdrop-blur-md">
                              <Plus size={13} className="text-white" />
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 truncate text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">{c.title}</p>
                        {c.year && <p className="text-[11px] text-text-tertiary">{c.year}</p>}
                      </button>
                    ))}
                  </div>
                  {visibleNotSeen.length < filteredNotSeen.length && (
                    <div className="mt-4 flex justify-center">
                      <Button variant="quiet" size="sm" onClick={() => setVisibleCount((n) => n + 18)}>
                        Load more ({filteredNotSeen.length - visibleNotSeen.length})
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        {/* ── RIGHT — your journey, the web around them, your verdict ── */}
        <div className="min-w-0">
          <div className="space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">
            <div className="hidden lg:block">
              <PersonJourney stats={journey} />
            </div>

            <SeenTogether titles={yourTitles} personId={personId} firstName={firstName} />
            <PersonInsights data={insights} firstName={firstName} />
          </div>
        </div>
      </div>

      <PersonTimelinePanel
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        titles={yourTitles}
        firstName={firstName}
      />

      <AddMediaModal
        isOpen={!!addItem}
        onClose={() => setAddItem(null)}
        onAdded={() => setAddItem(null)}
        defaultType={addItem?.media_type === "movie" ? "film" : "serie"}
        listContext="wantToWatch"
        initialItem={addItem}
      />
    </div>
  );
}
