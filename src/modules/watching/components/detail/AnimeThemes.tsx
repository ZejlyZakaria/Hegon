"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useAnimeThemes } from "../../hooks/useAnimeThemes";
import { useThemePlayer, type PlayerTrack } from "../../store/theme-player";
import type { WatchingMedia } from "../../types";

export function AnimeThemes({ media }: { media: WatchingMedia }) {
  const isAnime = media.type === "anime";
  const { data: groups = [], isLoading } = useAnimeThemes(media.title, media.year ?? null, isAnime, !!media.title);
  const { queue, index, isPlaying, play, toggle } = useThemePlayer();
  const currentId = queue[index]?.id ?? null;

  if (!isAnime) return null;
  if (!isLoading && groups.length === 0) return null;

  // Flat queue across every season/entry, so next/prev flows through the whole
  // franchise. Each track keeps a stable id for the "now playing" highlight.
  const flat: PlayerTrack[] = groups.flatMap((g, gi) =>
    g.tracks.map((t) => ({
      // gi disambiguates same-named entries (e.g. Hunter x Hunter 1999 vs 2011).
      id: `${media.tmdb_id}-${gi}-${t.label}`,
      label: t.label,
      title: t.title,
      artist: t.artist,
      audioUrl: t.audioUrl,
      videoUrl: t.videoUrl,
      animeName: g.name,
      cover: media.poster_url,
    })),
  );
  const indexOf = new Map(flat.map((t, i) => [t.id, i]));

  return (
    <div>
      <h2 className="mb-3 text-title text-text-primary">Openings &amp; Endings</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div key={`${gi}-${g.name}`}>
              <p className="mb-1.5 truncate text-[11px] font-medium text-text-tertiary">
                {g.name}
                {g.year ? <span className="text-text-tertiary/50"> · {g.year}</span> : null}
              </p>
              <div className="surface-quiet overflow-hidden rounded-2xl">
                {g.tracks.map((t) => {
                  const id = `${media.tmdb_id}-${gi}-${t.label}`;
                  const active = currentId === id;
                  const playingThis = active && isPlaying;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => (active ? toggle() : play(flat, indexOf.get(id) ?? 0))}
                      className={cn(
                        "group flex w-full items-center gap-3 border-b border-border-subtle px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-surface-2",
                        active && "bg-surface-2",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          active
                            ? "bg-accent-watching text-white"
                            : "bg-surface-3 text-text-secondary group-hover:bg-accent-watching group-hover:text-white",
                        )}
                      >
                        {playingThis ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-text-primary">
                          <span className="text-accent-watching-vivid">{t.label}</span> · {t.title}
                        </span>
                        {t.artist && (
                          <span className="block truncate text-[11px] text-text-tertiary">{t.artist}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
