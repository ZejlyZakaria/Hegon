"use client";

import { Check, Image as ImageIcon } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { cn } from "@/shared/utils/utils";
import { OS_WALLPAPERS } from "../config";
import { useDashboardLayout } from "../store";

// The wallpaper picker — opens from the Customize mode. Pass 1: CSS presets (live
// apply). Pass 2 will add "your photo" (upload to storage) + a net/blur toggle.
export function WallpaperPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wallpaper = useDashboardLayout((s) => s.wallpaper);
  const setWallpaper = useDashboardLayout((s) => s.setWallpaper);

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
                  "group relative aspect-[4/3] overflow-hidden rounded-xl transition",
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

        {/* Pass 2 — custom photo + net/blur toggle (placeholder for now) */}
        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-text-tertiary">Ta photo</p>
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong py-6 text-[13px] text-text-tertiary opacity-60"
        >
          <ImageIcon size={15} /> Bientôt — importer une image
        </button>
      </div>
    </SlidingPanel>
  );
}
