"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarClock, CalendarDays } from "lucide-react";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { useAlignedRail } from "../../hooks/useAlignedRail";
import type { WatchingUpdate } from "../../lib/updates";
import { tmdbImage, tmdbImageFor, tmdbImageSrcSet } from "../../lib/tmdb-image";
import { releaseCountdown } from "../../utils";
import { SectionImageReveal } from "../shared/SectionImageReveal";
import { AnnouncementCardsSkeleton } from "./UpdatesSkeleton";

const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });

function AnnouncementCard({ update }: { update: WatchingUpdate }) {
  const src = update.poster?.startsWith("/") ? `https://image.tmdb.org/t/p/w500${update.poster}` : update.poster;
  const countdown = update.state === "upcoming" ? releaseCountdown(update.date) : null;
  return <article data-announcement className="min-w-0">
    <Link href={`/perso/watching/${update.media.id}`} aria-label={`View ${update.media.title} · ${update.scope}`} className="group relative isolate flex h-full min-w-0 overflow-hidden rounded-card bg-surface-1 ring-1 ring-inset ring-border-subtle transition-colors hover:ring-border-default focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-watching-vivid">
      {src && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Image src={tmdbImage(src, "w92") || src} alt="" fill loading="lazy" sizes="96px" className="scale-[1.7] object-cover blur-3xl" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-black/35 to-black/65" />
      </div>}
      <div className="relative aspect-2/3 w-(--poster-md) shrink-0 self-start overflow-hidden bg-surface-2">
        <picture><source srcSet={tmdbImageSrcSet(src, 112, 500)} /><Image src={tmdbImageFor(src, 112) || "/placeholder.svg"} alt="" fill sizes="112px" loading="lazy" className="object-cover" /></picture>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 py-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">{update.media.title}</h3>
        <p className="mt-1 text-xs text-text-secondary">{update.scope}</p>
        <div className="mt-auto pt-2">
          {update.state === "upcoming" ? <>
            <p className="flex items-center gap-1.5 text-xs font-medium text-text-primary"><CalendarDays size={13} className="shrink-0 text-accent-watching-vivid" /><time dateTime={update.date!}>{dateLabel(update.date!, { day: "numeric", month: "short", year: "numeric" })}</time></p>
            {countdown && <p className="mt-1 text-caption text-text-tertiary">{/^\d/.test(countdown) ? `In ${countdown}` : countdown}</p>}
          </> : <p className="flex items-center gap-1.5 text-caption text-text-tertiary"><CalendarClock size={13} className="shrink-0" />{update.date ? "Release date unconfirmed" : "Date TBA"}</p>}
        </div>
      </div>
    </Link>
  </article>;
}

export function AnnouncementUpdates({ updates, title, subtitle, actions }: { updates: WatchingUpdate[]; title: string; subtitle: string; actions?: ReactNode }) {
  const { ref, scroll, canPrev, canNext } = useAlignedRail(updates.length);
  if (!updates.length) return null;
  return <section aria-label={title}>
    <SectionHeader className="[&>div:last-child]:max-w-full [&>div:last-child]:shrink [&>div:last-child]:flex-wrap" title={title} subtitle={subtitle} actions={<>{actions}{(canPrev || canNext) && <CarouselNav canPrev={canPrev} canNext={canNext} onPrev={() => scroll(-1)} onNext={() => scroll(1)} />}</>} />
    <SectionImageReveal fallback={<AnnouncementCardsSkeleton count={updates.length} />}>
      <div ref={ref} tabIndex={0} aria-label={`${title} releases`} className="flex gap-3 overflow-x-auto py-1 scrollbar-hide focus-visible:outline-2 focus-visible:outline-accent-watching-vivid">
        {updates.map(update => <div key={update.id} className="min-w-0 shrink-0 basis-[90%] md:basis-[calc((100%_-_0.75rem)/2)] lg:basis-[calc((100%_-_1.5rem)/3)] xl:basis-[calc((100%_-_2.25rem)/4)]"><AnnouncementCard update={update} /></div>)}
      </div>
    </SectionImageReveal>
  </section>;
}
