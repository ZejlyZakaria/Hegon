/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Music, Play, Shuffle } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { Button } from "@/shared/components/ui/button";
import { Hint } from "@/shared/components/ui/tooltip";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { useThemeFavorites } from "@/modules/watching/hooks/useThemeFavorites";
import { useThemeCovers } from "@/modules/watching/hooks/useThemeCovers";
import { themeTrackKey } from "@/modules/watching/service";
import { useThemePlayer, type PlayerTrack } from "@/modules/watching/store/theme-player";
import MyThemesView from "@/modules/watching/components/MyThemesView";

// Playing indicator — three bars breathing, Apple Music style.
function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-white"
          animate={{ height: ["30%", "100%", "45%", "85%", "35%"] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function ThemeTile({
  track, active, playing, onPlay,
}: {
  track: PlayerTrack;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group/tile w-36 shrink-0 snap-start text-left transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04] sm:w-40"
    >
      {/* Square artwork */}
      <div className={cn(
        "relative aspect-square w-full overflow-hidden rounded-modal bg-surface-2 ring-1 transition-shadow",
        active ? "ring-2 ring-accent-watching-vivid" : "ring-white/10",
      )}>
        {track.cover ? (
          <img src={track.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Music size={22} className="text-white/30" /></div>
        )}

        {/* Play / equalizer overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/60 via-black/10 to-transparent transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100",
        )}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25">
            {playing ? <Equalizer /> : <Play size={16} className="translate-x-0.5 fill-white text-white" />}
          </span>
        </div>

        {/* Label chip */}
        <span className="absolute left-2 top-2 rounded-chip bg-black/55 px-1.5 py-0.5 text-micro font-bold text-accent-watching-vivid backdrop-blur-sm">
          {track.label}
        </span>
      </div>

      {/* Meta — song title + anime name */}
      <p className="mt-2 truncate text-[13px] font-semibold text-text-primary">{track.title}</p>
      <p className="truncate text-micro text-text-tertiary">{track.animeName}</p>
    </button>
  );
}

export default function MyThemesSectionClient() {
  const { data: favorites = [], isLoading } = useThemeFavorites();
  const { queue, index, isPlaying, play, toggle } = useThemePlayer();

  const coverItems = useMemo(
    () => favorites.map((f) => ({ title: f.title, artist: f.artist })),
    [favorites],
  );
  const { data: liveCovers = {} } = useThemeCovers(coverItems);

  const tracks: PlayerTrack[] = useMemo(
    () =>
      favorites.map((f) => ({
        id: f.track_key,
        label: f.label,
        title: f.title,
        artist: f.artist,
        audioUrl: f.audio_url,
        videoUrl: f.video_url,
        animeName: f.anime_name,
        // Same square cover as the detail panel + player: live iTunes lookup
        // (identical function + cache), with the stored cover/poster as instant fallback.
        cover: liveCovers[`${f.title}|${f.artist}`] ?? f.cover ?? f.anime_poster,
        animePoster: f.anime_poster,
      })),
    [favorites, liveCovers],
  );

  // Active by stable key, so a theme playing from the detail rail also lights up here.
  const current = queue[index] ?? null;
  const activeKey = current ? themeTrackKey(current) : null;

  const [panelOpen, setPanelOpen] = useState(false);

  const shuffle = () => {
    const q = [...tracks];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    play(q, 0);
  };

  if (isLoading || tracks.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="My Themes"
        subtitle={`${tracks.length} favorite ${tracks.length === 1 ? "opening or ending" : "openings & endings"}`}
        actions={
          <>
            <Hint label="Shuffle">
              <Button variant="quiet" size="icon-sm" onClick={shuffle} aria-label="Shuffle">
                <Shuffle />
              </Button>
            </Hint>
            <Hint label="Play in order">
              <Button variant="quiet" size="icon-sm" onClick={() => play(tracks, 0)} aria-label="Play in order">
                <Play className="translate-x-px fill-current" />
              </Button>
            </Hint>
            <Button variant="quiet" size="sm" onClick={() => setPanelOpen(true)}>
              View all
            </Button>
          </>
        }
      />

      <div
        className="flex gap-4 overflow-x-auto scroll-smooth py-1.5 snap-x -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tracks.map((track, i) => {
          const active = activeKey === track.id;
          return (
            <ThemeTile
              key={track.id}
              track={track}
              active={active}
              playing={active && isPlaying}
              onPlay={() => (active ? toggle() : play(tracks, i))}
            />
          );
        })}
      </div>

      <SlidingPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="My Themes"
        icon={<Music size={16} className="text-accent-watching-vivid" />}
      >
        <MyThemesView />
      </SlidingPanel>
    </section>
  );
}
