/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { Check, ImageOff, Loader2, Upload } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { useMediaImages } from "../../hooks/useMediaImages";
import { useUpdateMedia } from "../../hooks/useUpdateMedia";
import { tmdbPathFromUrl } from "../../service";
import type { WatchingMedia } from "../../types";

type Tab = "posters" | "backdrops";

const TMDB = "https://image.tmdb.org/t/p";
// STORE the canonical size, DISPLAY a lighter one — the same split every surface makes (tmdbImageFor):
// a stored URL freezes one size, so we keep the convention the rest of the service writes (w500 poster,
// original backdrop) and only fetch a gallery-sized variant for the grid.
const STORE = { posters: "w500", backdrops: "original" } as const;
const SHOW = { posters: "w342", backdrops: "w780" } as const;
// A gallery is a CHOICE, not an archive — some titles carry 100+ images, and rendering all of them is
// weight for nothing. The list is sorted best-first (language then community score), so the top 24 are
// the ones worth offering.
const GALLERY_LIMIT = 24;

export function ImageGallery({ media }: { media: WatchingMedia }) {
  const [tab, setTab] = useState<Tab>("posters");
  const [uploading, setUploading] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDemo = useIsDemo();

  const { data, isLoading } = useMediaImages(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const updateMedia = useUpdateMedia();

  // The path of the artwork currently in use, for the "Current" ring. Null for an uploaded poster
  // (a Supabase URL tmdbPathFromUrl can't parse) — correct: no TMDB tile is the current one then.
  const currentPosterPath = tmdbPathFromUrl(media.poster_url);
  const currentBackdropPath = tmdbPathFromUrl(media.backdrop_url);

  const images = (tab === "posters" ? data?.posters ?? [] : data?.backdrops ?? []).slice(0, GALLERY_LIMIT);
  const currentPath = tab === "posters" ? currentPosterPath : currentBackdropPath;

  const setArtwork = async (filePath: string) => {
    const field = tab === "posters" ? "poster_url" : "backdrop_url";
    const url = `${TMDB}/${STORE[tab]}${filePath}`;
    setPendingPath(filePath);
    try {
      await updateMedia.mutateAsync({ id: media.id, type: media.type, [field]: url });
      toast(tab === "posters" ? "Poster updated." : "Backdrop updated.");
    } catch (err) {
      if (!isDemoReadOnlyError(err)) toast.error("Failed to update.");
    } finally {
      setPendingPath(null);
    }
  };

  const onUploadFile = async (file: File) => {
    if (isDemo) {
      toast("This is a read-only demo.");
      return;
    }
    setUploading(true);
    try {
      const { uploadCustomPoster } = await import("../../service");
      const url = await uploadCustomPoster(file);
      if (!url) {
        toast.error("Upload failed.");
        return;
      }
      await updateMedia.mutateAsync({ id: media.id, type: media.type, poster_url: url });
      toast("Poster updated.");
    } catch (err) {
      if (!isDemoReadOnlyError(err)) toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const isPoster = tab === "posters";
  // A GRID stays fluid (globals.css poster ladder): tiles take their width from the column, landing
  // near --poster-lg for posters. Radius follows the ladder — poster = tile, backdrop = card.
  const gridClass = isPoster
    ? "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(110px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]"
    : "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]";
  const tileFrame = isPoster ? "aspect-2/3 rounded-tile" : "aspect-video rounded-card";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "posters", label: "Posters" },
            { value: "backdrops", label: "Backdrops" },
          ]}
        />
        {isPoster && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUploadFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-control border border-border-subtle bg-surface-2 px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: isPoster ? 12 : 6 }).map((_, i) => (
            <div key={i} className={cn("w-full animate-pulse bg-surface-2", tileFrame)} />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <ImageOff size={28} className="text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            TMDB has no {isPoster ? "posters" : "backdrops"} for this title.
          </p>
        </div>
      ) : (
        <div className={gridClass}>
          {images.map((img) => {
            const current = currentPath === img.file_path;
            const pending = pendingPath === img.file_path;
            return (
              <button
                key={img.file_path}
                type="button"
                onClick={() => !current && setArtwork(img.file_path)}
                aria-label={current ? "Current artwork" : `Set as ${isPoster ? "poster" : "backdrop"}`}
                className={cn(
                  "group relative w-full overflow-hidden border transition-transform duration-300 ease-out",
                  tileFrame,
                  current
                    ? "cursor-default border-transparent ring-2 ring-accent-watching-vivid"
                    : "border-border-subtle hover:z-10 hover:scale-[1.03]",
                )}
              >
                <img
                  src={`${TMDB}/${SHOW[tab]}${img.file_path}`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />

                {/* Current = a quiet teal check, top-right. Not a full mask — you still want to see
                    the artwork you're using. */}
                {current && (
                  <span className="on-artwork absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full">
                    <Check size={13} style={{ color: "var(--color-accent-watching-vivid)" }} />
                  </span>
                )}

                {/* Hover affordance on the others — the gesture named, once. */}
                {!current && (
                  <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="mb-2 text-micro font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                      {pending ? "Setting…" : `Set as ${isPoster ? "poster" : "backdrop"}`}
                    </span>
                  </div>
                )}

                {pending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 size={18} className="animate-spin text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
