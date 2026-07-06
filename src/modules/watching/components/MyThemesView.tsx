/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Heart, Music, Pause, Play, Shuffle } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useThemeFavorites, useToggleThemeFavorite } from "@/modules/watching/hooks/useThemeFavorites";
import { useThemeCovers } from "@/modules/watching/hooks/useThemeCovers";
import { themeTrackKey } from "@/modules/watching/service";
import { useThemePlayer, type PlayerTrack } from "@/modules/watching/store/theme-player";

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

function Cover({ src, size }: { src: string | null; size: number }) {
  return src ? (
    <img src={src} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-surface-2">
      <Music size={size} className="text-white/25" />
    </div>
  );
}

// Body of the "My Themes" sliding panel: a vertical playlist hero (mosaic artwork +
// Play/Shuffle) followed by the full track list. Reuses the shared player + favorites.
export default function MyThemesView() {
  const { data: favorites = [], isLoading } = useThemeFavorites();
  const { queue, index, isPlaying, play, toggle } = useThemePlayer();
  const toggleFav = useToggleThemeFavorite();

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
        cover: liveCovers[`${f.title}|${f.artist}`] ?? f.cover ?? f.anime_poster,
        animePoster: f.anime_poster,
      })),
    [favorites, liveCovers],
  );

  const current = queue[index] ?? null;
  const activeKey = current ? themeTrackKey(current) : null;

  const shuffle = () => {
    const q = [...tracks];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    play(q, 0);
  };

  if (!isLoading && tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
          <Heart size={24} className="text-text-tertiary" />
        </div>
        <h2 className="text-title text-text-primary">No favorite themes yet</h2>
        <p className="mt-1.5 max-w-xs text-sm text-text-tertiary">
          Open an anime and tap the ♥ on any opening or ending — it lands here, ready to play.
        </p>
      </div>
    );
  }

  const mosaic = tracks.slice(0, 4).map((t) => t.cover);

  return (
    <div className="px-4 py-6">
      {/* Hero — vertical (fits the panel width) */}
      <div className="flex flex-col items-center text-center">
        <div className="aspect-square w-40 overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/10">
          {mosaic.length >= 4 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
              {mosaic.map((src, i) => (
                <div key={i} className="overflow-hidden"><Cover src={src} size={18} /></div>
              ))}
            </div>
          ) : (
            <Cover src={mosaic[0] ?? null} size={40} />
          )}
        </div>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-accent-watching-vivid">Playlist</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">My Themes</h2>
        <p className="mt-1 text-sm text-text-tertiary">
          {tracks.length} favorite {tracks.length === 1 ? "opening or ending" : "openings & endings"}
        </p>

        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => play(tracks, 0)}
            className="flex items-center gap-2 rounded-control px-5 py-2.5 text-sm font-semibold text-white transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "var(--color-accent-watching)" }}
          >
            <Play size={15} className="fill-current" />
            Play
          </button>
          <button
            type="button"
            onClick={shuffle}
            className="flex items-center gap-2 rounded-control border border-border-subtle bg-surface-2 px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <Shuffle size={15} />
            Shuffle
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className="mt-7 space-y-0.5">
        {tracks.map((track, i) => {
          const active = activeKey === track.id;
          const playing = active && isPlaying;
          return (
            <div
              key={track.id}
              className={cn(
                "group/row flex items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                active ? "bg-surface-2" : "hover:bg-surface-1",
              )}
            >
              <button
                type="button"
                onClick={() => (active ? toggle() : play(tracks, i))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex w-5 shrink-0 items-center justify-center text-xs tabular-nums text-text-tertiary">
                  {playing ? (
                    <Equalizer />
                  ) : (
                    <>
                      <span className="group-hover/row:hidden">{i + 1}</span>
                      <span className="hidden text-text-primary group-hover/row:block">
                        {active ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current" />}
                      </span>
                    </>
                  )}
                </div>

                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
                  <Cover src={track.cover} size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded bg-accent-watching-vivid/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-watching-vivid">{track.label}</span>
                    <span className={cn("min-w-0 truncate text-sm font-medium", active ? "text-accent-watching-vivid" : "text-text-primary")}>{track.title}</span>
                  </div>
                  <span className="mt-0.5 block truncate text-xs text-text-tertiary">{track.animeName}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleFav.mutate({ track, faved: true })}
                title="Remove from My Themes"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-[opacity,color] hover:text-text-primary group-hover/row:opacity-100"
              >
                <Heart size={16} className="fill-accent-watching-vivid text-accent-watching-vivid" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
