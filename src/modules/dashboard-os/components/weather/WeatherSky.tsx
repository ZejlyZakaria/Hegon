"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useMounted } from "@/shared/hooks/useMounted";
import {
  skyAt, celestialAt, localMinuteNow, unixToLocalMinute, toSkyCondition, rgb,
  applyOvercast, overcastFactor,
  type SkyCondition, type RGB,
} from "./sky";

// A living sky inside its container (absolute inset-0). Time-continuous palette
// driven by the location's real sunrise/sunset, a positioned sun/moon, volumetric
// clouds, depth-layered precipitation, stars, fog, lightning, grain + vignette.

const KEYFRAMES = `
@keyframes wsky-drift   { from { transform: translateX(-7%); } to { transform: translateX(7%); } }
@keyframes wsky-twinkle { 0%,100% { opacity: var(--o); } 50% { opacity: calc(var(--o) * 0.35); } }
@keyframes wsky-rain    { 0% { transform: translateY(-25%); } 100% { transform: translateY(170%); } }
@keyframes wsky-snow    { 0% { transform: translate(0,-15%); } 50% { transform: translate(var(--sx,8px),60%); } 100% { transform: translate(0,135%); } }
@keyframes wsky-flash   { 0%,54%,100% { opacity: 0; } 56% { opacity: 0.75; } 58% { opacity: 0.12; } 60% { opacity: 0.55; } 63% { opacity: 0; } }
@keyframes wsky-pulse   { 0%,100% { opacity: 0.8; } 50% { opacity: 1; } }
@keyframes wsky-drip    { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.6; } 100% { transform: translateY(16px); opacity: 0; } }
@keyframes wsky-veil    { 0%,100% { opacity: 0.10; } 50% { opacity: 0.22; } }
`;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// ─── clouds ───────────────────────────────────────────────────────────────────

interface CloudDef { x: number; y: number; w: number; depth: number; }
const CLOUDS: CloudDef[] = [
  { x: 12, y: 22, w: 62, depth: 0.35 },
  { x: 58, y: 14, w: 52, depth: 0.6 },
  { x: 78, y: 34, w: 70, depth: 0.85 },
  { x: 32, y: 40, w: 58, depth: 0.5 },
  { x: -6, y: 30, w: 48, depth: 0.75 },
];

function cloudColor(cond: SkyCondition, daylight: number, night: number): RGB {
  if (cond === "thunderstorm") return [44, 50, 66];
  if (cond === "rain" || cond === "drizzle") return night > 0.5 ? [46, 52, 68] : [96, 106, 124];
  // fair-weather clouds: bright white by day → dark slate by night
  const day: RGB = [248, 250, 255];
  const nite: RGB = [38, 44, 64];
  const t = 1 - daylight * (1 - night);
  return [day[0] + (nite[0] - day[0]) * Math.min(t, night), day[1] + (nite[1] - day[1]) * Math.min(t, night), day[2] + (nite[2] - day[2]) * Math.min(t, night)] as RGB;
}

// ─── precipitation data (deterministic — stable across re-renders) ────────────

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Flake { left: number; size: number; sx: number; op: number; blur: number; delay: number; dur: number }
function buildFlakes(seed: number, n: number, o: { sMin: number; sMax: number; blur: number; opMin: number; durMin: number; durMax: number }): Flake[] {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => ({
    left: r() * 100, size: o.sMin + r() * (o.sMax - o.sMin), sx: (r() < 0.5 ? -1 : 1) * (6 + r() * 14),
    op: o.opMin + r() * (1 - o.opMin), blur: o.blur, delay: r() * o.durMax, dur: o.durMin + r() * (o.durMax - o.durMin),
  }));
}
const SNOW_FAR = buildFlakes(41, 16, { sMin: 1.5, sMax: 2.6, blur: 1.1, opMin: 0.3, durMin: 7, durMax: 10 });
const SNOW_NEAR = buildFlakes(52, 12, { sMin: 2.6, sMax: 4.6, blur: 0.3, opMin: 0.55, durMin: 4.5, durMax: 7 });

function Clouds({ cond, daylight, night }: { cond: SkyCondition; daylight: number; night: number }) {
  const count =
    cond === "clear" ? 0 :
    cond === "clouds" ? 4 :
    cond === "fog" ? 2 :
    cond === "snow" ? 4 : 5; // rain / storm
  if (count === 0) return null;

  const base = cloudColor(cond, daylight, night);
  const dense = cond === "rain" || cond === "drizzle" || cond === "thunderstorm";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {CLOUDS.slice(0, count).map((c, i) => {
        const op = (dense ? 0.85 : 0.6) * (0.55 + c.depth * 0.45);
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${c.x}%`, top: `${c.y}%`,
              width: `${c.w * 1.3}%`, height: `${c.w * 1.3 * 0.62}%`,
              background: `radial-gradient(closest-side, ${rgb(base, op)}, ${rgb(base, op * 0.5)} 45%, transparent 72%)`,
              filter: `blur(${(6 + c.depth * 6) * 1.45}px)`,
              animation: `wsky-drift ${26 + i * 7}s ease-in-out ${i * -4}s infinite alternate`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── precipitation ────────────────────────────────────────────────────────────

// Canvas particle rain — one element, hundreds of depth-sorted drops with
// continuous opacity, real velocity + oscillating wind. The Apple approach
// (their app uses the same idea at larger scale); far cheaper than 200 blurred
// divs and actually reads like rain.
function RainCanvas({ heavy }: { heavy: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1, 2);
    const angle = heavy ? 0.28 : 0.2; // lean (~16° / 11°)

    type Drop = { x: number; y: number; len: number; sp: number; th: number; a: number };
    let w = 0, h = 0, raf = 0, wind = 0;
    let drops: Drop[] = [];

    const make = (): Drop => {
      const depth = Math.random(); // 0 far → 1 near
      return {
        x: Math.random() * (w + 80) - 40,
        y: Math.random() * h,
        len: 8 + depth * 22 * (heavy ? 1.2 : 1),
        sp: (1.6 + depth * 6) * (heavy ? 1.4 : 1),
        th: 0.4 + depth * 0.9,
        a: 0.04 + depth * 0.18,
      };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(420, Math.round(((w * h) / 210) * (heavy ? 1.4 : 1)));
      drops = Array.from({ length: n }, make);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      wind += 0.01;
      const a = angle + Math.sin(wind) * (heavy ? 0.05 : 0.035);
      const sinA = Math.sin(a), cosA = Math.cos(a);
      for (const d of drops) {
        d.x += sinA * d.sp;
        d.y += cosA * d.sp;
        if (d.y - d.len > h) { d.y = -d.len - Math.random() * 40; d.x = Math.random() * (w + 80) - 40; }
        // motion-blur streak: transparent tail → soft bright head (a real drop,
        // not a uniform line)
        const tx = d.x - sinA * d.len, ty = d.y - cosA * d.len;
        const g = ctx.createLinearGradient(tx, ty, d.x, d.y);
        g.addColorStop(0, "rgba(225,235,252,0)");
        g.addColorStop(0.85, `rgba(225,235,252,${(d.a * 0.7).toFixed(3)})`);
        g.addColorStop(1, `rgba(238,245,255,${d.a.toFixed(3)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = d.th;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    if (reduce) {
      draw();
      cancelAnimationFrame(raf); // one static frame, no loop
    } else {
      draw();
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(canvas); }
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [heavy]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" style={{ filter: "blur(0.4px)" }} />;
}

function Rain({ heavy }: { heavy: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <RainCanvas heavy={heavy} />
      {/* rain fog — Apple always mixes rain with atmospheric haze */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 100%, rgba(210,225,255,0.1), transparent 60%)", filter: "blur(24px)" }} />
      {/* lower mist */}
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(to top, rgba(210,224,245,0.12), transparent)", filter: "blur(8px)" }} />
    </div>
  );
}

function Snow() {
  const layers = [SNOW_FAR, SNOW_NEAR];
  return (
    <div className="absolute inset-0 overflow-hidden">
      {layers.map((layer, li) =>
        layer.map((f, i) => (
          <div
            key={`${li}-${i}`}
            className="absolute rounded-full bg-white"
            style={{
              left: `${f.left}%`, top: "-8%", width: f.size, height: f.size, opacity: f.op,
              ["--sx" as string]: `${f.sx}px`, filter: `blur(${f.blur}px)`,
              animation: `wsky-snow ${f.dur.toFixed(2)}s linear ${f.delay.toFixed(2)}s infinite`,
            }}
          />
        )),
      )}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 112%, rgba(232,240,255,0.1), transparent 60%)" }} />
    </div>
  );
}

function Fog() {
  const bands = [
    { top: "6%", h: "32%", o: 0.13, dur: 40, blur: 26, rev: false },
    { top: "28%", h: "36%", o: 0.18, dur: 30, blur: 30, rev: true },
    { top: "50%", h: "32%", o: 0.15, dur: 46, blur: 24, rev: false },
    { top: "68%", h: "34%", o: 0.2, dur: 34, blur: 28, rev: true },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden">
      {bands.map((f, i) => (
        <div
          key={i}
          className="absolute inset-x-[-25%]"
          style={{
            top: f.top, height: f.h, opacity: f.o,
            background: "radial-gradient(closest-side, rgba(216,224,234,0.9), transparent 76%)",
            filter: `blur(${f.blur}px)`,
            animation: `wsky-drift ${f.dur}s ease-in-out ${i * -3}s infinite ${f.rev ? "alternate-reverse" : "alternate"}`,
          }}
        />
      ))}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(202,212,224,0.16), transparent 55%)" }} />
    </div>
  );
}

// ─── stars ────────────────────────────────────────────────────────────────────

const STARS = (() => {
  const r = mulberry32(99);
  return Array.from({ length: 90 }, () => ({
    x: r() * 100, y: r() * 64, s: 0.5 + r() * r() * 1.8, o: 0.3 + r() * 0.65, tw: 2.2 + r() * 3.2,
  }));
})();

function Stars({ night }: { night: number }) {
  if (night < 0.06) return null;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {STARS.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s,
            ["--o" as string]: (s.o * night).toFixed(2),
            opacity: s.o * night,
            animation: `wsky-twinkle ${s.tw.toFixed(1)}s ease-in-out ${(i * 0.13).toFixed(2)}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── celestial body ───────────────────────────────────────────────────────────

function Sun({ x, y, daylight, dim }: { x: number; y: number; daylight: number; dim: number }) {
  // warm at the horizon, white-gold at noon
  const core = `rgb(${255},${247 - (1 - daylight) * 40},${225 - (1 - daylight) * 90})`;
  const glow = daylight > 0.5 ? "rgba(255,244,214," : "rgba(255,180,110,";
  const op = (0.5 + daylight * 0.5) * (1 - dim);
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", opacity: op }}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 230, height: 230, background: `radial-gradient(closest-side, ${glow}0.55), ${glow}0.16) 42%, transparent 68%)`, filter: "blur(10px)", animation: "wsky-pulse 6s ease-in-out infinite" }}
      />
      <div className="relative rounded-full" style={{ width: 24, height: 24, background: core, boxShadow: `0 0 30px 8px ${glow}0.7)` }} />
    </div>
  );
}

function Moon({ x, y, night }: { x: number; y: number; night: number }) {
  if (night < 0.1) return null;
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", opacity: night }}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 90, height: 90, background: "radial-gradient(closest-side, rgba(214,224,255,0.4), transparent 70%)", filter: "blur(6px)" }}
      />
      <div className="relative overflow-hidden rounded-full" style={{ width: 22, height: 22, background: "radial-gradient(circle at 35% 30%, #f3f6ff, #c7d2f0)", boxShadow: "0 0 16px 3px rgba(200,214,255,0.5)" }}>
        <div className="absolute rounded-full bg-black/10" style={{ width: 6, height: 6, top: 5, left: 11 }} />
        <div className="absolute rounded-full bg-black/10" style={{ width: 4, height: 4, top: 12, left: 6 }} />
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export interface WeatherSkyProps {
  condition?: string;
  sunrise?: number | null;   // unix
  sunset?: number | null;    // unix
  timezone?: number;         // seconds offset
  // lab overrides (force a scene without live data) — all in LOCAL minutes-of-day
  forceMinute?: number;
  forceSunrise?: number;
  forceSunset?: number;
  forceCondition?: string;
  className?: string;
}

export function WeatherSky({
  condition, sunrise, sunset, timezone = 0,
  forceMinute, forceSunrise, forceSunset, forceCondition, className = "",
}: WeatherSkyProps) {
  const [tick, setTick] = useState(0);
  // Mount gate — the sky depends on Date.now() + client-cached weather, so we
  // render a deterministic fallback on the server / first paint, then the live
  // scene. Kills the hydration mismatch.
  const mounted = useMounted();

  // recompute the sky each minute so it drifts toward dusk/dawn in real time
  useEffect(() => {
    if (forceMinute !== undefined) return;
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [forceMinute]);

  const { sky, body, cond } = useMemo(() => {
    const minute = forceMinute ?? localMinuteNow(timezone);
    const srMin = forceSunrise ?? (sunrise ? unixToLocalMinute(sunrise, timezone) : 390);
    const ssMin = forceSunset ?? (sunset ? unixToLocalMinute(sunset, timezone) : 1170);
    return {
      sky: skyAt(minute, srMin, ssMin),
      body: celestialAt(minute, srMin, ssMin),
      cond: toSkyCondition(forceCondition ?? condition),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, sunrise, sunset, timezone, forceMinute, forceSunrise, forceSunset, forceCondition, tick]);

  const ocf = overcastFactor(cond);
  const adj = applyOvercast(sky, cond);
  const starNight = sky.nightFactor * (1 - ocf * 0.85);
  const moonNight = sky.nightFactor * (1 - ocf * 0.9);
  const sunDim = Math.min(
    0.92,
    cond === "snow" ? 0.7 : cond === "fog" ? 0.65 : ocf > 0 ? 0.45 + ocf * 0.6 : 0,
  );

  // server / first paint → deterministic fallback (see mount gate above)
  if (!mounted) {
    return (
      <div
        className={`absolute inset-0 overflow-hidden ${className}`}
        style={{ background: "linear-gradient(to bottom, #1a2540, #11182f 60%, #0e1430)" }}
      />
    );
  }

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <style>{KEYFRAMES}</style>

      {/* base sky */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${rgb(adj.top)}, ${rgb(adj.mid)} 52%, ${rgb(adj.bot)})` }}
      />
      {/* horizon glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: `linear-gradient(to top, ${rgb(adj.bot, 0.5)}, transparent)` }}
      />

      {/* celestial */}
      {body.body === "sun"
        ? <Sun x={body.x} y={body.y} daylight={sky.daylight} dim={sunDim} />
        : <Moon x={body.x} y={body.y} night={moonNight} />}

      <Stars night={starNight} />
      <Clouds cond={cond} daylight={sky.daylight} night={sky.nightFactor} />
      {(cond === "rain" || cond === "drizzle" || cond === "thunderstorm") && <Rain heavy={cond !== "drizzle"} />}
      {cond === "snow" && <Snow />}
      {cond === "fog" && <Fog />}

      {/* lightning — top-down blue-white flash + subtle full flash */}
      {cond === "thunderstorm" && (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(202,216,255,0.9), transparent 58%)", animation: "wsky-flash 7s linear infinite", mixBlendMode: "screen" }} />
          <div className="absolute inset-0 bg-white" style={{ opacity: 0.5, animation: "wsky-flash 7s linear 0.06s infinite", mixBlendMode: "screen" }} />
        </>
      )}

      {/* atmospheric veil — a sense of air, not a flat fill */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 16%, rgba(255,255,255,0.07), transparent 60%)", mixBlendMode: "screen" }} />
      {/* grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN, backgroundSize: "120px 120px" }} />
      {/* vignette + top rim */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 100% at 50% 0%, transparent 55%, rgba(0,0,0,0.4))" }} />
      <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
    </div>
  );
}
