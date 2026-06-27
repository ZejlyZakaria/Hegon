"use client";

import { useRef, useState } from "react";
import { Check, Image as ImageIcon, Loader2 } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { OS_WALLPAPERS } from "../config";
import { useDashboardLayout } from "../store";
import { uploadWallpaper } from "../service";

// The wallpaper picker — opens from the Customize mode. CSS presets OR a custom
// photo (uploaded to storage) with a net/blur toggle, all applied live.
export function WallpaperPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wallpaper = useDashboardLayout((s) => s.wallpaper);
  const setWallpaper = useDashboardLayout((s) => s.setWallpaper);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasCustom = !!wallpaper.imageUrl;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    const url = await uploadWallpaper(file);
    setUploading(false);
    if (url) setWallpaper({ imageUrl: url });
    else toast.error("Échec de l'upload.");
  };

  // a preset is "active" only when no custom image overrides it
  const activePresetId = wallpaper.imageUrl ? null : wallpaper.id;

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      title="Wallpaper"
      icon={<ImageIcon size={16} className="text-text-tertiary" />}
    >
      <div className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-tertiary">Presets</p>
        <div className="grid grid-cols-2 gap-3">
          {OS_WALLPAPERS.map((wp) => {
            const active = wp.id === activePresetId;
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => setWallpaper({ id: wp.id, imageUrl: undefined })}
                className={cn(
                  "group relative aspect-4/3 overflow-hidden rounded-xl transition",
                  active ? "ring-2 ring-violet-400" : "ring-1 ring-white/10 hover:ring-white/25",
                )}
              >
                <span className="absolute inset-0" style={{ background: wp.css }} />
                {active && (
                  <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white text-zinc-900 shadow">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-2.5 pb-1.5 pt-5 text-left text-[12px] font-medium text-white">
                  {wp.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom photo + net/blur toggle */}
        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-text-tertiary">Ta photo</p>

        {hasCustom ? (
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl ring-2 ring-violet-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wallpaper.imageUrl}
                alt=""
                className={cn("h-full w-full object-cover", wallpaper.blur && "scale-105 blur-md")}
              />
              <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white text-zinc-900 shadow">
                <Check size={13} strokeWidth={3} />
              </span>
            </div>

            {/* Net / Flou segmented control */}
            <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
              {[
                { label: "Net", blur: false },
                { label: "Flou", blur: true },
              ].map((opt) => {
                const on = !!wallpaper.blur === opt.blur;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setWallpaper({ blur: opt.blur })}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-colors",
                      on ? "bg-surface-0 text-text-primary shadow" : "text-text-tertiary hover:text-text-secondary",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-xl border border-border-strong py-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-2"
            >
              {uploading ? "Upload…" : "Changer l'image"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong py-6 text-[13px] text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary disabled:opacity-60"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
            {uploading ? "Upload en cours…" : "Importer une image"}
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </SlidingPanel>
  );
}
