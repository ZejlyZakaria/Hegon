"use client";

import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { PersonFace } from "@/modules/watching/components/shared/PersonFace";
import { FaceCellsSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import type { CastMember, CreditedDirector } from "../../hooks/useMediaCredits";

/**
 * THE RAIL IS PAGED, 8 FACES TO A PAGE — owner, 2026-09-16 (was 9 faces, free-scrolling).
 *
 * Sixteen people now, the crew first: the whole cast is on the row already (no cap at storage,
 * see mapCredits), so showing more costs no request. The faces grew so a follow « + » can sit on
 * the rim of each one without crowding the name — hence 8 to a row, not 9. Prev / next are the
 * same `CarouselNav` every rail in the module uses, and the page moves by a full row.
 *
 * Series show their CREATORS again (Creator / Series Director / EP, the jobs mapCredits already
 * picked and this component used to hide) — the honest word under the face is "Creator".
 */
const MAX_TOTAL = 16;
const GAP = 16;

function perView(w: number) { return w < 640 ? 4 : w < 1024 ? 6 : 8; }

/**
 * THE SPACE THIS RAIL WILL OCCUPY, HELD WHILE ITS FACES ARE STILL COMING.
 *
 * The cast is a separate TMDB request — deliberately, because folding credits into the title bundle
 * cost 165 KB — so on a discover page it lands after everything around it. The section simply did
 * not exist until then, and when it appeared it SHOVED "More Like This" down the page, under the
 * reader's eye. A screen that rearranges itself after you have started reading is the same fault as
 * a screen that changes its mind about a value.
 *
 * It lives beside the real component on purpose: a skeleton in another file drifts from the layout
 * it is meant to stand in for, and then it reserves the wrong height — which is the bug again, with
 * extra steps. Same wrapper, same size, same count.
 */
export function CastCrewSkeleton() {
  return (
    <section aria-hidden>
      <SectionHeader title="Cast & Crew" />
      <div className="-mx-4 overflow-x-hidden px-4 sm:mx-0 sm:px-0">
        <FaceCellsSkeleton rail="cast" />
      </div>
    </section>
  );
}

interface Props {
  cast: CastMember[];
  directors: CreditedDirector[];
  isSeries: boolean;
}

export function CastCrew({ cast, directors, isSeries }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(8);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const onResize = () => setN(perView(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (cast.length === 0 && directors.length === 0) return null;

  const crew = directors
    .filter((d, i, arr) => arr.findIndex((x) => x.name === d.name) === i)
    .map((d) => ({ id: d.id, name: d.name, src: d.profile_url, subtitle: isSeries ? "Creator" : "Director" }));
  const people = [
    ...crew,
    ...cast.slice(0, Math.max(0, MAX_TOTAL - crew.length)).map((p) => ({ id: p.id, name: p.name, src: p.profile_url, subtitle: p.character })),
  ];
  const pages = Math.max(1, Math.ceil(people.length / n));
  const current = Math.min(page, pages - 1);
  const style = { width: `calc((100% - ${(n - 1) * GAP}px) / ${n})` };

  const go = (to: number) => {
    const el = railRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(pages - 1, to));
    setPage(next);
    // One page = the rail's own width: the row scrolls by exactly what it shows.
    el.scrollTo({ left: next * (el.clientWidth + GAP), behavior: "smooth" });
  };

  return (
    <section>
      <SectionHeader
        title="Cast & Crew"
        actions={pages > 1 ? <CarouselNav className="hidden lg:flex" onPrev={() => go(current - 1)} onNext={() => go(current + 1)} canPrev={current > 0} canNext={current < pages - 1} /> : undefined}
      />
      {/* Same bleed as every other rail: break out of the column gutter so a face can scroll under
          the screen edge, and start at the same x as its neighbours. py-1 is the hover scale's
          headroom — an overflow-x container clips vertically too. */}
      <div
        ref={railRef}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 py-1 sm:mx-0 sm:px-0 sm:scroll-px-0"
        style={{ scrollbarWidth: "none" }}
      >
        {people.map((person, i) => (
          <PersonFace key={`${person.name}-${i}`} id={person.id} name={person.name} src={person.src} subtitle={person.subtitle} knownFor={person.subtitle === "Director" || person.subtitle === "Creator" ? "Directing" : "Acting"} style={style} />
        ))}
      </div>
    </section>
  );
}
