/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Music, Pause, Play, SkipBack, SkipForward, Video, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { useThemePlayer } from "../store/theme-player";

function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ThemePlayer() {
  const { queue, index, isPlaying, showVideo, toggle, setPlaying, next, prev, openVideo, closeVideo, close } =
    useThemePlayer();
  const current = queue[index] ?? null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Load + play the current track. Playing the video pauses the audio (its webm
  // carries its own sound), so we don't stack two audio streams.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (isPlaying && !showVideo) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, showVideo, current, setPlaying]);

  if (!current) return null;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <>
      <audio
        ref={audioRef}
        src={current.audioUrl ?? current.videoUrl ?? undefined}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={next}
      />

      <AnimatePresence>
        <motion.div
          key="theme-player"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl"
        >
          {/* Progress bar (top edge, seekable) */}
          <div className="group/prog h-1 w-full cursor-pointer bg-white/10" onClick={seek}>
            <div className="h-full bg-accent-watching transition-[width] duration-100" style={{ width: `${pct}%` }} />
          </div>

          <div className="flex items-center gap-3 p-3">
            {/* Cover */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
              {current.cover ? (
                <img src={current.cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music size={16} className="text-white/40" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                <span className="text-accent-watching-vivid">{current.label}</span> · {current.title}
              </p>
              <p className="truncate text-[11px] text-white/50">
                {current.artist || current.animeName}
              </p>
              <p className="mt-0.5 text-[10px] tabular-nums text-white/35">{fmt(time)} / {fmt(duration)}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                <SkipBack size={15} className="fill-current" />
              </button>
              <button type="button" onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105">
                {isPlaying && !showVideo ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
              </button>
              <button type="button" onClick={next} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                <SkipForward size={15} className="fill-current" />
              </button>
            </div>
          </div>

          {/* Secondary row — video toggle + close */}
          <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5">
            <button
              type="button"
              onClick={openVideo}
              disabled={!current.videoUrl}
              className="flex items-center gap-1.5 text-[11px] font-medium text-white/55 transition-colors hover:text-white disabled:opacity-30"
            >
              <Video size={12} />
              Watch video
            </button>
            <button type="button" onClick={close} className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80">
              <X size={13} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Video lightbox (bonus) — pauses the audio while open */}
      <Dialog open={showVideo} onOpenChange={(v) => { if (!v) closeVideo(); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-3xl overflow-hidden border-border-strong bg-black p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">{current.title}</DialogTitle>
          <DialogDescription className="sr-only">{current.label} — {current.animeName}</DialogDescription>
          {showVideo && current.videoUrl && (
            <video src={current.videoUrl} controls autoPlay className="aspect-video w-full bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
