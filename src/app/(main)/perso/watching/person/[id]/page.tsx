"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Search, Star } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { cn } from "@/shared/utils/utils";
import { usePersonBundle, useTitlesByPerson } from "@/modules/watching/hooks/usePerson";
import { PersonHero } from "@/modules/watching/components/person/PersonHero";
import { PersonJourney } from "@/modules/watching/components/person/PersonJourney";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { PersonCredit, PersonTitle } from "@/modules/watching/service";

const DEPT_LABEL: Record<string, string> = {
  Acting: "Actor", Directing: "Director", Writing: "Writer", Production: "Producer",
};
const AMBER = "#fbbf24";
// Our stored urls are full (w342) — strip back to the raw TMDB path the modal expects.
const stripSize = (u: string | null) => (u ? u.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, "") : null);

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="text-right text-xs font-medium text-text-secondary">{value}</span>
    </div>
  );
}

// Status pill on a "your titles" tile (watched → the rating badge shows instead).
function titleBadge(t: PersonTitle): { label: string; cls: string; position?: string } | null {
  if (t.watched) return null;
  if (t.dropped) return { label: "Dropped", cls: "text-amber-300" };
  if (t.paused) return { label: "Paused", cls: "text-sky-300" };
  if (t.in_progress) {
    const position = t.type !== "film" && t.current_season ? `S${t.current_season}·E${t.current_episode ?? 0}` : undefined;
    return { label: "Watching", cls: "text-accent-watching-vivid", position };
  }
  if (t.want_to_watch) return { label: "Want to watch", cls: "text-violet-300" };
  return null;
}

export default function PersonPage() {
  const params = useParams<{ id: string }>();
  const personId = Number(params.id);
  const router = useRouter();
  const userId = useCurrentUserId();

  const { data: bundle, isLoading } = usePersonBundle(personId);
  const { data: yourTitles = [] } = useTitlesByPerson(userId ?? "", personId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [addItem, setAddItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(18);

  if (isLoading || !bundle) {
    return (
      <div className="min-h-screen bg-surface-0">
        <div className="aspect-video w-full animate-pulse bg-surface-1 lg:aspect-21/9" />
      </div>
    );
  }

  const { profile, credits } = bundle;
  const roleLabel = DEPT_LABEL[profile.known_for_department ?? ""] ?? profile.known_for_department ?? "Person";
  const firstName = profile.name.split(" ")[0];

  // ── Your relationship with this person ──
  const owned = yourTitles.length;
  const total = credits.length;
  const watched = yourTitles.filter((t) => t.watched);
  const rated = yourTitles.filter((t) => t.user_rating != null);
  const avgRating = rated.length ? rated.reduce((s, t) => s + (t.user_rating ?? 0), 0) / rated.length : null;
  const top = rated.length ? rated.reduce((a, b) => ((b.user_rating ?? 0) > (a.user_rating ?? 0) ? b : a)) : null;

  const ownedIds = new Set(yourTitles.map((t) => t.tmdb_id));
  const notSeen = credits.filter((c) => !ownedIds.has(c.tmdb_id));
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
    top: top ? { id: top.id, title: top.title, poster_url: top.poster_url, user_rating: top.user_rating, year: top.year } : null,
  };

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
        <div className="min-w-0 space-y-6 px-4 py-6 lg:space-y-8 lg:py-8 lg:pl-8 lg:pr-2">
          {yourTitles.length > 0 && (
            <section>
              <h2 className="mb-3 text-title text-text-primary">Your titles with {firstName}</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {yourTitles.map((t) => {
                  const badge = titleBadge(t);
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
                        {badge && (
                          <>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/90 via-black/40 to-transparent" />
                            <div className="absolute inset-x-1.5 bottom-1.5 z-10 flex items-end justify-between gap-1">
                              <span className={cn("shrink-0 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-white/10 backdrop-blur-sm", badge.cls)}>{badge.label}</span>
                              {badge.position && (
                                <span className="min-w-0 truncate rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 ring-1 ring-white/10 backdrop-blur-sm">{badge.position}</span>
                              )}
                            </div>
                          </>
                        )}
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-title text-text-primary">
                  Not seen yet <span className="text-text-tertiary">({notSeen.length})</span>
                </h2>
                <div className="relative w-full sm:w-60">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setVisibleCount(18); }}
                    placeholder="Search their films…"
                    className="w-full rounded-control border border-border-subtle bg-surface-1 py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
                  />
                </div>
              </div>

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
                      <button
                        type="button"
                        onClick={() => setVisibleCount((n) => n + 18)}
                        className="rounded-full border border-border-subtle bg-surface-1 px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                      >
                        Load more ({filteredNotSeen.length - visibleNotSeen.length})
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        {/* ── RIGHT — branded journey + reference ── */}
        <div className="min-w-0">
          <div className="space-y-6 px-4 py-6 lg:space-y-8 lg:py-8 lg:pl-2 lg:pr-8">
            <div className="hidden lg:block">
              <PersonJourney stats={journey} />
            </div>

            <section>
              <h2 className="mb-3 text-title text-text-primary">Details</h2>
              <div className="surface-quiet overflow-hidden rounded-card">
                <div className="divide-y divide-border-subtle px-4">
                  <Row label="Known for" value={roleLabel} />
                  {profile.birthday && (
                    <Row label="Born" value={new Date(profile.birthday).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
                  )}
                  {profile.place_of_birth && <Row label="From" value={profile.place_of_birth} />}
                  <Row label="Filmography" value={`${total} titles`} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

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
