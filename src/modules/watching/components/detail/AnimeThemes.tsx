/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Loader2, Music, Play, Shuffle } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { Hint } from "@/shared/components/ui/tooltip";
import { Panel } from "@/shared/components/ui/panel";
import { WATCHING_ACCENT } from "../../ui";
import { useAnimeThemes } from "../../hooks/useAnimeThemes";
import { useThemeFavorites, useToggleThemeFavorite } from "../../hooks/useThemeFavorites";
import { useThemePlayer, type PlayerTrack } from "../../store/theme-player";
import { themeTrackKey } from "../../service";
import type { WatchingMedia } from "../../types";

// Now-playing equalizer — three bars breathing, Apple Music style.
function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-white"
          animate={{ height: ["25%", "100%", "45%", "80%", "30%"] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

// A single theme row — Spotify style: its background is the artwork blurred (so the
// row is tinted by the cover's colours), a crisp square thumbnail with a play /
// equalizer overlay, title/artist, and a ♥ favorite toggle.
function ThemeRow({
  track, active, playing, faved, onPlay, onToggleFav,
}: {
  track: PlayerTrack;
  active: boolean;
  playing: boolean;
  faved: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
}) {
  const cover = track.cover;

  return (
    <div className="group relative overflow-hidden rounded-xl">
      {/* Colour tint pulled from the artwork (blurred), + dark scrim for legibility */}
      {cover && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(18px) saturate(1.7)",
            transform: "scale(1.5)",
          }}
        />
      )}
      <div className={cn("pointer-events-none absolute inset-0 transition-colors", active ? "bg-black/45" : "bg-black/70 group-hover:bg-black/60")} />

      <div className="relative flex items-center gap-2.5 px-2 py-1.5">
        <button type="button" onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          {/* Crisp thumbnail + overlay */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><Music size={14} className="text-white/40" /></div>
            )}
            <div className={cn("absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
              {playing ? <Equalizer /> : <Play size={14} className="fill-white text-white" />}
            </div>
          </div>

          {/* Info — hard-truncated */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 rounded bg-accent-watching-vivid/25 px-1.5 py-0.5 text-[10px] font-bold text-accent-watching-vivid">{track.label}</span>
              <span className="min-w-0 truncate text-xs font-semibold text-white">{track.title}</span>
            </div>
            {track.artist && <span className="mt-0.5 block truncate text-[11px] text-white/55">{track.artist}</span>}
          </div>
        </button>

        {/* Favorite */}
        <button
          type="button"
          onClick={onToggleFav}
          title={faved ? "Remove from My Themes" : "Add to My Themes"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:text-white"
        >
          <Heart size={15} className={faved ? "fill-accent-watching-vivid text-accent-watching-vivid" : ""} />
        </button>
      </div>
    </div>
  );
}

export function AnimeThemes({ media }: { media: WatchingMedia }) {
  const isAnime = media.type === "anime";
  const { data: groups = [], isLoading } = useAnimeThemes(media.title, media.year ?? null, isAnime, !!media.title);
  const { queue, index, isPlaying, play, toggle } = useThemePlayer();
  const currentId = queue[index]?.id ?? null;

  const { data: favorites = [] } = useThemeFavorites();
  const toggleFav = useToggleThemeFavorite();
  const favKeys = useMemo(() => new Set(favorites.map((f) => f.track_key)), [favorites]);

  const flat: PlayerTrack[] = useMemo(
    () =>
      groups.flatMap((g, gi) =>
        g.tracks.map((t) => ({
          id: `${media.tmdb_id}-${gi}-${t.label}`,
          label: t.label,
          title: t.title,
          artist: t.artist,
          audioUrl: t.audioUrl,
          videoUrl: t.videoUrl,
          animeName: g.name,
          cover: t.cover ?? media.poster_url,
          animePoster: media.poster_url,
        })),
      ),
    [groups, media.tmdb_id, media.poster_url],
  );
  const indexOf = useMemo(() => new Map(flat.map((t, i) => [t.id, i])), [flat]);

  const defaultPart = useMemo(() => {
    if (media.year == null || groups.length <= 1) return 0;
    let best = 0, bestDiff = Infinity;
    groups.forEach((g, i) => {
      const d = Math.abs((g.year ?? 9999) - media.year!);
      if (d < bestDiff) { bestDiff = d; best = i; }
    });
    return best;
  }, [groups, media.year]);
  const [part, setPart] = useState<number | null>(null);
  const activePart = part ?? defaultPart;

  if (!isAnime) return null;
  if (!isLoading && groups.length === 0) return null;

  const group = groups[activePart];
  const shuffle = () => {
    // Fisher-Yates — an unbiased shuffle (unlike sort(() => 0.5 - Math.random())).
    const q = [...flat];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    play(q, 0);
  };
  const partOf = (label: string) => flat.find((t) => t.id === `${media.tmdb_id}-${activePart}-${label}`);

  return (
    <Panel
      title="Openings & Endings"
      subtitle={flat.length > 0 ? `${flat.length} themes` : undefined}
      actions={
        flat.length > 0 ? (
          <>
            <Hint label="Shuffle">
              <Button variant="quiet" size="icon-sm" onClick={shuffle} aria-label="Shuffle">
                <Shuffle />
              </Button>
            </Hint>
            <Button variant="accent" size="sm" style={WATCHING_ACCENT} onClick={() => play(flat, 0)}>
              <Play className="fill-current" />
              Play
            </Button>
          </>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-text-tertiary" /></div>
      ) : (
        <>
          {groups.length > 1 && (
            <FilterSelect
              size="sm"
              className="mb-2 w-full"
              value={String(activePart)}
              onChange={(v) => setPart(Number(v))}
              options={groups.map((g, i) => ({
                value: String(i),
                label: `${g.name}${g.year ? ` · ${g.year}` : ""} (${g.tracks.length})`,
              }))}
              aria-label="Season"
            />
          )}

          <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-hide">
            {group?.tracks.map((t) => {
              const track = partOf(t.label);
              if (!track) return null;
              const active = currentId === track.id;
              const faved = favKeys.has(themeTrackKey(track));
              return (
                <ThemeRow
                  key={track.id}
                  track={track}
                  active={active}
                  playing={active && isPlaying}
                  faved={faved}
                  onPlay={() => (active ? toggle() : play(flat, indexOf.get(track.id) ?? 0))}
                  onToggleFav={() => toggleFav.mutate({ track, faved })}
                />
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
