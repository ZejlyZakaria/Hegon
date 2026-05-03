"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import type { DashboardData, DashboardMedia, DashboardSportEvent } from "../../types";
import { COMPETITION_LOGO, GRACE_MS, PARIS_TZ } from "../../constants";

// ── Config ────────────────────────────────────────────────────────────────────

const COMPETITION_BG: Record<string, string> = {
  "UEFA Champions League": "/assets/dashboard/ucl-card-bg.png",
};

const SPORT_BG: Record<string, string> = {
  football: "/assets/dashboard/football-card-bg.png",
  f1: "/assets/dashboard/f1-card-bg.webp",
  tennis: "/assets/dashboard/tennis-card-bg.webp",
};

// ── shared card shell ─────────────────────────────────────────────────────────

function CardShell({
  bgSrc,
  children,
  className = "",
}: {
  bgSrc?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-950 flex flex-col ${className}`}>
      {bgSrc && (
        <Image
          src={bgSrc}
          alt=""
          fill
          unoptimized
          onLoad={() => setImgLoaded(true)}
          className={`object-cover transition-opacity duration-700 ease-in-out ${imgLoaded ? "opacity-[0.12]" : "opacity-0"}`}
        />
      )}
      {children}
    </div>
  );
}

function CardEmpty({ label, color, message }: { label: string; color: string; message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1.5 p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{label}</p>
      <p className="text-xs text-zinc-700 italic text-center">{message}</p>
    </div>
  );
}

// ── Watching card ─────────────────────────────────────────────────────────────

function episodeLabel(m: DashboardMedia): string | null {
  if ((m.type === "serie" || m.type === "anime") && m.current_season && m.current_episode)
    return `S${String(m.current_season).padStart(2, "0")}E${String(m.current_episode).padStart(2, "0")}`;
  return null;
}

function episodeProgress(m: DashboardMedia): number | null {
  if (!m.current_episode || !m.current_season || !m.season_episodes) return null;
  const episodes = m.season_episodes;
  const totalEpisodes = episodes.reduce((sum, n) => sum + n, 0);
  if (totalEpisodes === 0) return null;
  const watchedInPrevSeasons = episodes.slice(0, m.current_season - 1).reduce((sum, n) => sum + n, 0);
  const watched = watchedInPrevSeasons + m.current_episode;
  return Math.round((watched / totalEpisodes) * 100);
}

function WatchingCard({ media }: { media: DashboardMedia | null }) {
  return (
    <CardShell
      bgSrc={media ? (media.backdrop_url ?? media.poster_url) : null}
      className="min-h-44"
    >
      {media ? (
        <>
          <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none" />
          <div className="relative flex flex-col flex-1 p-4 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">
                In Progress
              </span>
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border bg-violet-500/10 border-violet-500/20 text-violet-400">
                {media.type === "serie" ? "Serie" : "Anime"}
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-end gap-1.5">
              <p className="text-[13px] font-semibold text-zinc-100 leading-snug line-clamp-2">
                {media.title}
              </p>
              {episodeLabel(media) && (
                <p className="text-[10px] text-zinc-400">{episodeLabel(media)}</p>
              )}
              {(() => {
                const p = episodeProgress(media);
                return p !== null ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-0.75 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{p}%</span>
                  </div>
                ) : null;
              })()}
            </div>

            <Link href="/perso/watching" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
              View all →
            </Link>
          </div>
        </>
      ) : (
        <CardEmpty label="Watching" color="#8b5cf6" message="Nothing in progress" />
      )}
    </CardShell>
  );
}

// ── shared time formatter (Paris timezone) ────────────────────────────────────

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
  const eventDateStr = d.toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
  const isToday = todayStr === eventDateStr;

  const timeStr = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS_TZ,
  });
  const hasTime = timeStr !== "00:00";
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PARIS_TZ });

  if (isToday) return hasTime ? timeStr : dateLabel;
  return hasTime ? `${dateLabel} · ${timeStr}` : dateLabel;
}

// ── Football card ─────────────────────────────────────────────────────────────

function FootballCard({ event }: { event: DashboardSportEvent | null }) {
  const compLogo = event?.competition ? (COMPETITION_LOGO[event.competition] ?? null) : null;
  const bgSrc = event?.competition
    ? (COMPETITION_BG[event.competition] ?? SPORT_BG.football)
    : SPORT_BG.football;

  return (
    <CardShell bgSrc={bgSrc} className="min-h-44">
      <div className="relative flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
            Football
          </span>
          {compLogo && (
            <div className="relative w-10 h-5">
              <Image
                src={compLogo}
                alt={event!.competition ?? ""}
                fill
                unoptimized
                className="object-contain object-right"
                style={{ filter: "brightness(0) invert(1)", opacity: 0.45 }}
              />
            </div>
          )}
        </div>

        {event ? (
          <>
            <div className="flex-1 flex items-center justify-center gap-3 py-2">
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                {event.homeTeamCrest ? (
                  <div className="relative w-10 h-10 shrink-0">
                    <Image src={event.homeTeamCrest} alt={event.homeTeam ?? ""} fill sizes="40px" className="object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">⚽</div>
                )}
                <span className="text-[9px] font-semibold text-zinc-300 text-center line-clamp-2 w-full leading-tight">
                  {event.homeTeam}
                </span>
              </div>

              <span className="text-[10px] font-black text-zinc-700 shrink-0">VS</span>

              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                {event.awayTeamCrest ? (
                  <div className="relative w-10 h-10 shrink-0">
                    <Image src={event.awayTeamCrest} alt={event.awayTeam ?? ""} fill sizes="40px" className="object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">⚽</div>
                )}
                <span className="text-[9px] font-semibold text-zinc-300 text-center line-clamp-2 w-full leading-tight">
                  {event.awayTeam}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-zinc-600 truncate">{event.competition ?? ""}</span>
              <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{formatEventTime(event.date)}</span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-zinc-700 italic">No upcoming match</p>
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ── Tennis card ───────────────────────────────────────────────────────────────

function TennisCard({ event }: { event: DashboardSportEvent | null }) {
  return (
    <CardShell bgSrc={SPORT_BG.tennis} className="min-h-44">
      <div className="relative flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">Tennis</span>
          <div className="relative w-10 h-5">
            <Image
              src="/assets/dashboard/ATP-white-logo.webp"
              alt="ATP"
              fill
              unoptimized
              className="object-contain object-right"
              style={{ opacity: 0.35 }}
            />
          </div>
        </div>

        {event ? (
          event.playerName ? (
            <>
              <div className="flex-1 flex items-center gap-3 py-2">
                {event.playerPhotoUrl ? (
                  <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border border-amber-500/20">
                    <Image
                      src={event.playerPhotoUrl}
                      alt={event.playerName}
                      fill
                      unoptimized
                      className="object-cover object-top"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-full bg-zinc-800 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-amber-400/70">
                      {event.playerName.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-zinc-100 truncate">{event.playerName}</p>
                  {event.opponentName && (
                    <p className="text-[10px] text-zinc-500 truncate">vs {event.opponentName}</p>
                  )}
                  {event.tournamentName && (
                    <p className="text-[10px] text-zinc-600 truncate mt-0.5">{event.tournamentName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                {event.round ? (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-amber-500/70">{event.round}</span>
                ) : <span />}
                <span className="text-[10px] text-zinc-400 tabular-nums">{formatEventTime(event.date)}</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2 text-center px-2">
              {(event.tournamentName ?? event.title) && (
                <p className="text-[12px] font-semibold text-zinc-200">{event.tournamentName ?? event.title}</p>
              )}
              <p className="text-[10px] text-zinc-600 leading-snug">
                None of your favourite players<br />has a match scheduled
              </p>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px] text-zinc-600">No upcoming match</p>
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ── F1 card ───────────────────────────────────────────────────────────────────

function F1Card({ event }: { event: DashboardSportEvent | null }) {
  return (
    <CardShell bgSrc={SPORT_BG.f1} className="min-h-44">
      <div className="relative flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">F1</span>
          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-red-500/10 border-red-500/20 text-red-400">
            Racing
          </span>
        </div>

        {event ? (
          <>
            <div className="flex-1 flex flex-col justify-center gap-2 py-2">
              <div className="relative w-12 h-6">
                <Image
                  src="/assets/dashboard/F1-white-logo.png"
                  alt="F1"
                  fill
                  unoptimized
                  className="object-contain object-left"
                />
              </div>
              <p className="text-[13px] font-semibold text-zinc-100 leading-snug">{event.title}</p>
              {event.circuit && (
                <div className="flex items-center gap-1">
                  <MapPin size={9} className="text-zinc-600 shrink-0" />
                  <span className="text-[10px] text-zinc-500 truncate">{event.circuit}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-zinc-600 truncate">{event.country ?? ""}</span>
              <span className="text-[10px] text-zinc-400 shrink-0">{formatEventTime(event.date)}</span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-zinc-700 italic">No upcoming race</p>
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

function isActive(e: DashboardSportEvent): boolean {
  return new Date(e.date).getTime() > Date.now() - GRACE_MS;
}

interface Props {
  data: DashboardData;
}

export default function MediaSportsRow({ data }: Props) {

  const watchingMedia =
    data.inProgressMediaList.find((m) => m.type === "serie" || m.type === "anime") ??
    data.inProgressMediaList[0] ??
    null;

  const footballEvent =
    data.todayFootballEvents.find(isActive) ??
    data.sportEvents.find((e) => e.type === "football") ??
    null;

  const tennisEvent =
    data.todayTennisEvents.find(isActive) ??
    data.sportEvents.find((e) => e.type === "tennis") ??
    null;

  const f1Event =
    (data.todayF1Event && isActive(data.todayF1Event) ? data.todayF1Event : null) ??
    data.sportEvents.find((e) => e.type === "f1") ??
    null;

  const cards = [
    <WatchingCard key="watching" media={watchingMedia} />,
    <FootballCard key="football" event={footballEvent} />,
    <TennisCard key="tennis" event={tennisEvent} />,
    <F1Card key="f1" event={f1Event} />,
  ];

  return (
    <section>
      <div className="grid grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.07, ease: "easeOut" }}
          >
            {card}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
