/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Heart, Music, Pause, Play, SkipBack, SkipForward, Video, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { useThemePlayer } from "../store/theme-player";
import { useThemeFavorites } from "../store/theme-favorites";
import { useItunesArtwork } from "../hooks/useItunesArtwork";

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
  const { data: itunesArt } = useItunesArtwork(current?.title ?? "", current?.artist ?? "", !!current);
  const faved = useThemeFavorites((s) => (current ? !!s.favorites[current.id] : false));
  const toggleFav = useThemeFavorites((s) => s.toggle);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (isPlaying && !showVideo) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [isPlaying, showVideo, current, setPlaying]);

  if (!current) return null;

  const cover = itunesArt ?? current.cover;
  const pct = duration ? (time / duration) * 100 : 0;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={current.audioUrl ?? current.videoUrl ?? undefined}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={next}
      />

      {/* ── Mini-player (docked) ── */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            key="mini"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-4 right-4 z-40 w-85 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl"
          >
            <div className="group/prog h-1 w-full cursor-pointer bg-white/10" onClick={seek}>
              <div className="h-full bg-accent-watching transition-[width] duration-100" style={{ width: `${pct}%` }} />
            </div>

            <div className="flex items-center gap-3 p-3">
              <button type="button" onClick={() => setExpanded(true)} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10" title="Open player">
                {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Music size={16} className="text-white/40" /></div>}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30">
                  <ChevronUp size={16} className="text-white opacity-0 transition-opacity hover:opacity-100" />
                </div>
              </button>

              <button type="button" onClick={() => setExpanded(true)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-semibold text-white">
                  <span className="text-accent-watching-vivid">{current.label}</span> · {current.title}
                </p>
                <p className="truncate text-[11px] text-white/50">{current.artist || current.animeName}</p>
                <p className="mt-0.5 text-[10px] tabular-nums text-white/35">{fmt(time)} / {fmt(duration)}</p>
              </button>

              <div className="flex items-center gap-0.5">
                <button type="button" onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"><SkipBack size={15} className="fill-current" /></button>
                <button type="button" onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105">{isPlaying && !showVideo ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}</button>
                <button type="button" onClick={next} className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"><SkipForward size={15} className="fill-current" /></button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5">
              <button type="button" onClick={openVideo} disabled={!current.videoUrl} className="flex items-center gap-1.5 text-[11px] font-medium text-white/55 transition-colors hover:text-white disabled:opacity-30"><Video size={12} />Watch video</button>
              <button type="button" onClick={close} className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"><X size={13} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Now Playing (full screen) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="full"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed inset-0 z-50 overflow-hidden"
          >
            {/* Background = the cover, blurred + darkened */}
            {cover && <div className="absolute inset-0" style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) saturate(1.8)", transform: "scale(1.4)" }} />}
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/80" />

            <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-6 pb-10 pt-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setExpanded(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"><ChevronDown size={20} /></button>
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Openings &amp; Endings</p>
                  <p className="truncate text-xs font-medium text-white/80">{current.animeName}</p>
                </div>
                <button type="button" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"><X size={18} /></button>
              </div>

              <div className="flex flex-1 flex-col justify-center gap-8">
                {/* Cover */}
                <div className="mx-auto aspect-square w-full max-w-[20rem] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-white/5"><Music size={48} className="text-white/30" /></div>}
                </div>

                <div>
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold text-white">{current.title}</p>
                      <p className="mt-0.5 truncate text-sm text-white/55">
                        <span className="text-accent-watching-vivid">{current.label}</span> · {current.artist || current.animeName}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleFav(current)} className="mt-1 shrink-0 text-white/60 transition-colors hover:text-white">
                      <Heart size={22} className={faved ? "fill-accent-watching-vivid text-accent-watching-vivid" : ""} />
                    </button>
                  </div>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="group/prog h-1.5 w-full cursor-pointer rounded-full bg-white/15" onClick={seek}>
                      <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-white/50">
                      <span>{fmt(time)}</span>
                      <span>-{fmt(Math.max(0, duration - time))}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-4 flex items-center justify-center gap-6">
                    <button type="button" onClick={prev} className="text-white/80 transition-colors hover:text-white"><SkipBack size={26} className="fill-current" /></button>
                    <button type="button" onClick={toggle} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform hover:scale-105">
                      {isPlaying && !showVideo ? <Pause size={26} className="fill-current" /> : <Play size={26} className="fill-current translate-x-0.5" />}
                    </button>
                    <button type="button" onClick={next} className="text-white/80 transition-colors hover:text-white"><SkipForward size={26} className="fill-current" /></button>
                  </div>

                  {current.videoUrl && (
                    <div className="mt-6 flex justify-center">
                      <button type="button" onClick={openVideo} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"><Video size={14} />Watch video</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video lightbox — pauses the audio while open */}
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
