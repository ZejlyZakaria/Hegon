"use client";

import { useMemo, useState } from "react";

// ─── Watch faces (unlocked by streak tiers — collection lands with DB) ──────────

export type WatchFace = "onyx" | "sapphire" | "champagne" | "slate";

interface FaceConfig {
  label: string;
  unlockStreak: number; // best streak (days) required to unlock
  bezel: string; // polished case rim (conic gradient) — also the collection chip
  rehaut: string; // inner ring between case and dial
  dialBase: string; // dial radial gradient (center → edge)
  sunburst: string; // repeating-conic ray color (brushed guilloché)
  sheen: string; // soft top-left highlight on the dial
  index: string; // applied baton indices + hour ticks
  minuteTick: string; // fine minute track
  maker: string; // printed dial text
  handLight: string; // dauphine hand — lit facet
  handDark: string; // dauphine hand — shadow facet
  second: string; // seconds needle + counterweight (the one vivid accent)
  capOuter: string;
  capInner: string;
  starfield?: boolean; // aventurine cosmic dial (top tier)
}

export const FACES: Record<WatchFace, FaceConfig> = {
  onyx: {
    label: "Onyx",
    unlockStreak: 0,
    bezel:
      "conic-gradient(from 140deg, #43454a, #9a9da6, #2c2e33, #7e818b, #2c2e33, #9a9da6, #43454a)",
    rehaut: "#08080a",
    dialBase: "radial-gradient(circle at 50% 36%, #1e1e23 0%, #0a0a0d 76%)",
    sunburst: "rgba(255,255,255,0.05)",
    sheen:
      "radial-gradient(circle at 36% 28%, rgba(255,255,255,0.10), transparent 42%)",
    index: "#d8dade",
    minuteTick: "#5b5e66",
    maker: "rgba(226,226,230,0.38)",
    handLight: "#f1f2f5",
    handDark: "#a6aab2",
    second: "var(--color-accent-habits-vivid)",
    capOuter: "#d3d5da",
    capInner: "#3a3c42",
  },
  sapphire: {
    label: "Sapphire",
    unlockStreak: 7,
    bezel:
      "conic-gradient(from 140deg, #43454a, #9a9da6, #2c2e33, #7e818b, #2c2e33, #9a9da6, #43454a)",
    rehaut: "#060c18",
    dialBase: "radial-gradient(circle at 50% 36%, #1d4178 0%, #08152e 78%)",
    sunburst: "rgba(150,190,255,0.07)",
    sheen:
      "radial-gradient(circle at 36% 28%, rgba(180,210,255,0.16), transparent 44%)",
    index: "#dbe7ff",
    minuteTick: "#5c79ad",
    maker: "rgba(205,225,255,0.42)",
    handLight: "#eef4ff",
    handDark: "#9db6e0",
    second: "var(--color-accent-habits-vivid)",
    capOuter: "#cfdcf2",
    capInner: "#274a7e",
  },
  champagne: {
    label: "Champagne",
    unlockStreak: 30,
    bezel:
      "conic-gradient(from 140deg, #6e5526, #e7c489, #8a6c30, #f3d99a, #8a6c30, #e7c489, #6e5526)",
    rehaut: "#7a6230",
    dialBase: "radial-gradient(circle at 50% 36%, #f5ecd6 0%, #dac99e 82%)",
    sunburst: "rgba(120,92,34,0.06)",
    sheen:
      "radial-gradient(circle at 36% 28%, rgba(255,255,255,0.45), transparent 46%)",
    index: "#5b4a22",
    minuteTick: "#9c875a",
    maker: "rgba(70,54,22,0.55)",
    handLight: "#7a6630",
    handDark: "#4a3a18",
    second: "var(--color-accent-habits-vivid)",
    capOuter: "#8a6c30",
    capInner: "#f3d99a",
  },
  slate: {
    label: "Aventurine",
    unlockStreak: 100,
    bezel:
      "conic-gradient(from 140deg, #7a7d85, #e6e9ef, #565a62, #c4c8d0, #565a62, #e6e9ef, #7a7d85)",
    rehaut: "#05060a",
    dialBase:
      "radial-gradient(circle at 50% 40%, #1b2a4e 0%, #0a1226 45%, #05070f 82%)",
    sunburst: "rgba(255,255,255,0.015)",
    sheen:
      "radial-gradient(circle at 36% 26%, rgba(150,180,255,0.14), transparent 46%)",
    index: "#ece7d4",
    minuteTick: "#3a4666",
    maker: "rgba(220,228,255,0.42)",
    handLight: "#f4f0e2",
    handDark: "#b9b09a",
    second: "var(--color-accent-habits-vivid)",
    capOuter: "#e2dccb",
    capInner: "#243a64",
    starfield: true,
  },
};

export const FACE_ORDER: WatchFace[] = ["onyx", "sapphire", "champagne", "slate"];

// ─── Geometry (viewBox 0 0 176 176, center 88) ──────────────────────────────────

const C = 88;
const TICKS = Array.from({ length: 60 }, (_, i) => i);
const HOURS = Array.from({ length: 12 }, (_, i) => i);

// Deterministic aventurine starfield (seeded once, stable across renders).
const STARFIELD = (() => {
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: 44 }, () => {
    const ang = rnd() * Math.PI * 2;
    const rad = 16 + rnd() * 58; // keep clear of the very center
    return {
      x: C + rad * Math.cos(ang),
      y: C + rad * Math.sin(ang),
      r: 0.3 + rnd() * 0.95,
      o: 0.22 + rnd() * 0.68,
    };
  });
})();

function polar(r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
}

function computeHands() {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  return {
    second: { angle: s * 6, dur: 60, delay: -s },
    minute: { angle: m * 6, dur: 3600, delay: -(m * 60) },
    hour: { angle: h * 30, dur: 43200, delay: -(h * 3600) },
  };
}

// A faceted dauphine hand pointing to 12, split down the middle into a lit and a
// shadowed half so it catches light like a real polished hand.
function DauphineHand({
  length,
  halfWidth,
  tail,
  shoulder,
  light,
  dark,
}: {
  length: number;
  halfWidth: number;
  tail: number;
  shoulder: number;
  light: string;
  dark: string;
}) {
  const tipY = C - length;
  const shoulderY = C - length * shoulder;
  const baseY = C + tail;
  return (
    <>
      <polygon
        points={`${C},${tipY} ${C + halfWidth},${shoulderY} ${C},${baseY}`}
        fill={light}
      />
      <polygon
        points={`${C},${tipY} ${C - halfWidth},${shoulderY} ${C},${baseY}`}
        fill={dark}
      />
    </>
  );
}

function Hand({
  angle,
  dur,
  delay,
  children,
}: {
  angle: number;
  dur: number;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <g
      style={{
        transformBox: "view-box",
        transformOrigin: "88px 88px",
        transform: `rotate(${angle}deg)`,
        animation: `hb-spin ${dur}s linear infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </g>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────────

interface Props {
  face?: WatchFace;
  size?: number;
  className?: string;
}

export function HabitWatch({ face = "onyx", size = 176, className }: Props) {
  const cfg = FACES[face];
  const [hands] = useState(computeHands);

  const minuteTicks = useMemo(
    () =>
      TICKS.filter((i) => i % 5 !== 0).map((i) => {
        const o = polar(81, i * 6);
        const inn = polar(78, i * 6);
        return { i, x1: o.x, y1: o.y, x2: inn.x, y2: inn.y };
      }),
    [],
  );

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Analog clock"
    >
      <div className="relative h-full w-full select-none">
        {/* Polished case */}
        <div className="absolute inset-0 rounded-full" style={{ background: cfg.bezel }} />
        {/* Rehaut (inner ring) */}
        <div
          className="absolute inset-1.5 rounded-full"
          style={{ background: cfg.rehaut }}
        />
        {/* Dial */}
        <div
          className="absolute inset-2.25 overflow-hidden rounded-full"
          style={{ background: cfg.dialBase }}
        >
          {/* guilloché sunburst */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `repeating-conic-gradient(from 0deg at 50% 50%, ${cfg.sunburst} 0deg 1.6deg, transparent 1.6deg 3.2deg)`,
            }}
          />
          {/* soft sheen */}
          <div className="absolute inset-0 rounded-full" style={{ background: cfg.sheen }} />
        </div>

        {/* Dial detail + hands */}
        <svg className="absolute inset-2.25" viewBox="0 0 176 176" fill="none">
          {/* aventurine starfield */}
          {cfg.starfield &&
            STARFIELD.map((s, i) => (
              <circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#dfe7ff" opacity={s.o} />
            ))}

          {/* minute track */}
          {minuteTicks.map((t) => (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={cfg.minuteTick}
              strokeWidth={0.8}
              strokeLinecap="round"
            />
          ))}

          {/* applied baton indices (double baton at 12 for orientation) */}
          {HOURS.map((h) => {
            const isTwelve = h === 0;
            return (
              <g key={h} transform={`rotate(${h * 30} ${C} ${C})`}>
                {isTwelve ? (
                  <>
                    <rect x={C - 4.4} y={13} width={2.6} height={13} rx={1.1} fill={cfg.index} />
                    <rect x={C + 1.8} y={13} width={2.6} height={13} rx={1.1} fill={cfg.index} />
                  </>
                ) : (
                  <rect x={C - 1.6} y={13} width={3.2} height={12} rx={1.3} fill={cfg.index} />
                )}
              </g>
            );
          })}

          {/* maker text */}
          <text
            x={C}
            y={58}
            textAnchor="middle"
            fontSize={6.2}
            fontWeight={600}
            letterSpacing={1.4}
            fill={cfg.maker}
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            HEGON
          </text>
          <text
            x={C}
            y={124}
            textAnchor="middle"
            fontSize={4.6}
            letterSpacing={1.2}
            fill={cfg.maker}
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            AUTOMATIC
          </text>

          {/* Hour hand */}
          <Hand angle={hands.hour.angle} dur={hands.hour.dur} delay={hands.hour.delay}>
            <DauphineHand
              length={46}
              halfWidth={4.6}
              tail={13}
              shoulder={0.42}
              light={cfg.handLight}
              dark={cfg.handDark}
            />
          </Hand>

          {/* Minute hand */}
          <Hand angle={hands.minute.angle} dur={hands.minute.dur} delay={hands.minute.delay}>
            <DauphineHand
              length={67}
              halfWidth={3.7}
              tail={15}
              shoulder={0.4}
              light={cfg.handLight}
              dark={cfg.handDark}
            />
          </Hand>

          {/* Second hand — needle + counterweight */}
          <Hand angle={hands.second.angle} dur={hands.second.dur} delay={hands.second.delay}>
            <line x1={C} y1={C + 22} x2={C} y2={18} stroke={cfg.second} strokeWidth={1.3} strokeLinecap="round" />
            <circle cx={C} cy={C + 16} r={3.4} fill={cfg.second} />
          </Hand>

          {/* Center cap */}
          <circle cx={C} cy={C} r={4.6} fill={cfg.capOuter} />
          <circle cx={C} cy={C} r={2} fill={cfg.capInner} />
        </svg>
      </div>
    </div>
  );
}
