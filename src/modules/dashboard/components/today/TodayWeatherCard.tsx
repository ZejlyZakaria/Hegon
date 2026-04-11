"use client";

import { useQuery, } from "@tanstack/react-query";
import { useId } from "react";
import { Droplets, Wind, MapPin } from "lucide-react";

// ─── Theme system ─────────────────────────────────────────────────────────────

interface WeatherTheme {
  atmosphere: string;
  glow: string;
  border: string;
  accent: string;
  specular: string;
}

function getWeatherTheme(condition: string, hour: number): WeatherTheme {
  if (condition === "Thunderstorm") return {
    atmosphere: "linear-gradient(to bottom, rgba(88,28,135,0.45) 0%, rgba(30,27,75,0.30) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 90% 55% at 50% -15%, rgba(167,139,250,0.22), transparent)",
    border: "border-purple-500/25",
    accent: "text-purple-300",
    specular: "rgba(167,139,250,0.55)",
  };
  if (condition === "Rain" || condition === "Drizzle") return {
    atmosphere: "linear-gradient(to bottom, rgba(30,64,175,0.38) 0%, rgba(51,65,85,0.22) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(96,165,250,0.16), transparent)",
    border: "border-blue-500/20",
    accent: "text-blue-300",
    specular: "rgba(96,165,250,0.45)",
  };
  if (condition === "Snow") return {
    atmosphere: "linear-gradient(to bottom, rgba(186,230,253,0.28) 0%, rgba(224,242,254,0.14) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(224,242,254,0.22), transparent)",
    border: "border-sky-200/20",
    accent: "text-sky-100",
    specular: "rgba(186,230,253,0.55)",
  };
  if (condition === "Clouds") return {
    atmosphere: "linear-gradient(to bottom, rgba(100,116,139,0.32) 0%, rgba(71,85,105,0.16) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(148,163,184,0.13), transparent)",
    border: "border-slate-500/20",
    accent: "text-slate-300",
    specular: "rgba(148,163,184,0.32)",
  };
  if (["Mist", "Fog", "Haze", "Dust", "Sand"].includes(condition)) return {
    atmosphere: "linear-gradient(to bottom, rgba(148,163,184,0.24) 0%, rgba(100,116,139,0.12) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(203,213,225,0.11), transparent)",
    border: "border-slate-400/15",
    accent: "text-slate-300",
    specular: "rgba(203,213,225,0.28)",
  };

  const isDawn      = hour >= 5  && hour < 7;
  const isMorning   = hour >= 7  && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEvening   = hour >= 17 && hour < 21;

  if (isDawn) return {
    atmosphere: "linear-gradient(to bottom, rgba(251,146,60,0.42) 0%, rgba(253,186,116,0.22) 40%, rgba(251,113,133,0.12) 65%, transparent 85%)",
    glow: "radial-gradient(ellipse 70% 55% at 80% 0%, rgba(251,146,60,0.38), transparent)",
    border: "border-orange-500/25",
    accent: "text-orange-200",
    specular: "rgba(251,146,60,0.65)",
  };
  if (isMorning) return {
    atmosphere: "linear-gradient(to bottom, rgba(56,189,248,0.36) 0%, rgba(14,165,233,0.18) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 60% 50% at 88% -5%, rgba(255,255,255,0.20), transparent)",
    border: "border-sky-400/25",
    accent: "text-sky-200",
    specular: "rgba(56,189,248,0.65)",
  };
  if (isAfternoon) return {
    atmosphere: "linear-gradient(to bottom, rgba(14,165,233,0.40) 0%, rgba(56,189,248,0.22) 50%, transparent 82%)",
    glow: "radial-gradient(ellipse 50% 40% at 90% 0%, rgba(255,255,255,0.24), transparent)",
    border: "border-sky-400/30",
    accent: "text-sky-200",
    specular: "rgba(56,189,248,0.72)",
  };
  if (isEvening) return {
    atmosphere: "linear-gradient(to bottom, rgba(251,113,133,0.40) 0%, rgba(251,146,60,0.24) 42%, rgba(168,85,247,0.12) 68%, transparent 86%)",
    glow: "radial-gradient(ellipse 70% 55% at 12% 0%, rgba(251,146,60,0.38), transparent)",
    border: "border-rose-500/25",
    accent: "text-rose-200",
    specular: "rgba(251,113,133,0.60)",
  };
  // Night
  return {
    atmosphere: "linear-gradient(to bottom, rgba(15,23,42,0.80) 0%, rgba(30,27,75,0.45) 40%, rgba(49,46,129,0.20) 65%, transparent 85%)",
    glow: "radial-gradient(ellipse 38% 30% at 75% 8%, rgba(199,210,254,0.20), transparent)",
    border: "border-indigo-500/22",
    accent: "text-indigo-200",
    specular: "rgba(165,180,252,0.48)",
  };
}

// ─── Scene elements ───────────────────────────────────────────────────────────

// Fixed star positions — natural constellation-like spread
const STARS = [
  { x:  8, y: 12, s: 1.5, o: 0.90 }, { x: 18, y:  6, s: 1.0, o: 0.65 },
  { x: 29, y: 16, s: 2.0, o: 0.80 }, { x: 42, y:  8, s: 1.0, o: 0.55 },
  { x: 55, y: 20, s: 1.5, o: 0.75 }, { x: 63, y:  5, s: 1.0, o: 0.70 },
  { x: 71, y: 24, s: 1.0, o: 0.50 }, { x: 82, y: 10, s: 1.5, o: 0.88 },
  { x: 91, y: 18, s: 1.0, o: 0.60 }, { x: 36, y: 28, s: 1.0, o: 0.45 },
  { x: 49, y: 32, s: 1.5, o: 0.65 }, { x: 77, y: 30, s: 1.0, o: 0.55 },
  { x: 23, y: 30, s: 1.0, o: 0.40 }, { x: 60, y: 13, s: 1.0, o: 0.78 },
  { x: 95, y: 22, s: 1.5, o: 0.68 }, { x: 12, y: 35, s: 1.0, o: 0.42 },
];

// Snow dot positions
const SNOW_DOTS = [
  { x: 12, y: 14, s: 3 }, { x: 28, y: 8,  s: 2 }, { x: 45, y: 20, s: 3 },
  { x: 62, y: 10, s: 2 }, { x: 78, y: 25, s: 3 }, { x: 90, y: 14, s: 2 },
  { x: 20, y: 30, s: 2 }, { x: 55, y: 32, s: 2 }, { x: 85, y: 32, s: 3 },
];

function NightStars() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {STARS.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o }}
        />
      ))}
    </div>
  );
}

function SunGlow({ position }: { position: "left" | "right" }) {
  const style = position === "right"
    ? { top: "-30%", right: "-8%" }
    : { top: "-30%", left: "-8%" };
  return (
    <div className="absolute pointer-events-none" style={style} aria-hidden>
      <div
        style={{
          width: 110, height: 110,
          background: "radial-gradient(circle, rgba(255,230,80,0.30) 0%, rgba(251,191,36,0.16) 35%, rgba(251,146,60,0.08) 60%, transparent 75%)",
          filter: "blur(6px)",
        }}
      />
    </div>
  );
}

// ─── Weather animation keyframes ─────────────────────────────────────────────

const RAIN_KEYFRAMES = `
  @keyframes hegon-rain-far {
    0%   { transform: translate3d(12px, -24px, 0) rotate(14deg); opacity: 0; }
    14%  { opacity: 0.16; }
    100% { transform: translate3d(-24px, 118px, 0) rotate(14deg); opacity: 0; }
  }
  @keyframes hegon-rain-mid {
    0%   { transform: translate3d(16px, -28px, 0) rotate(15deg); opacity: 0; }
    12%  { opacity: 0.28; }
    100% { transform: translate3d(-31px, 124px, 0) rotate(15deg); opacity: 0; }
  }
  @keyframes hegon-rain-near {
    0%   { transform: translate3d(18px, -34px, 0) rotate(16deg); opacity: 0; }
    10%  { opacity: 0.42; }
    100% { transform: translate3d(-38px, 132px, 0) rotate(16deg); opacity: 0; }
  }
  @keyframes hegon-rain-shimmer {
    0%, 100% { opacity: 0.18; }
    50%      { opacity: 0.36; }
  }
  @keyframes hegon-cloud-drift-a {
    0%   { transform: translate3d(0, 0, 0) scale(1); }
    50%  { transform: translate3d(10px, 2px, 0) scale(1.025); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes hegon-cloud-drift-b {
    0%   { transform: translate3d(0, 0, 0) scale(1); }
    50%  { transform: translate3d(-12px, 4px, 0) scale(1.03); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes hegon-cloud-drift-c {
    0%   { transform: translate3d(0, 0, 0) scale(1); }
    50%  { transform: translate3d(6px, -1px, 0) scale(1.015); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes hegon-cloud-pulse {
    0%, 100% { opacity: 0.7; }
    50%      { opacity: 1; }
  }
`;

// ─── SVG cloud ────────────────────────────────────────────────────────────────

function CloudPuff({
  left, top, opacity, scale = 1, flipX = false, fill = "white", blur = 1.5,
}: {
  left: string; top: string; opacity: number; scale?: number; flipX?: boolean; fill?: string; blur?: number;
}) {
  const uid = useId();
  const bodyId = `hegon-cloud-body-${uid}`;
  const highlightId = `hegon-cloud-highlight-${uid}`;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left, top, opacity,
        transform: `scale(${scale}) ${flipX ? "scaleX(-1)" : ""}`,
        transformOrigin: "top left",
        filter: `blur(${blur}px)`,
      }}
      aria-hidden
    >
      <svg width="250" height="100" viewBox="0 0 250 100" fill="none">
        <defs>
          <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="100">
            <stop offset="0%"   stopColor={fill} stopOpacity="0.96" />
            <stop offset="55%"  stopColor={fill} stopOpacity="0.88" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id={highlightId} x1="0" y1="0" x2="0" y2="80">
            <stop offset="0%"   stopColor="white" stopOpacity="0.34" />
            <stop offset="45%"  stopColor="white" stopOpacity="0.08" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M20 72 C20 58,30 48,45 46 C48 29,62 18,80 18 C92 18,103 24,110 33
             C117 22,131 14,147 14 C170 14,188 29,191 49 C205 50,217 59,223 71
             C228 82,222 90,205 90 L42 90 C28 90,19 84,18 76 C18 75,18 74,20 72Z"
          fill={`url(#${bodyId})`}
        />
        <path
          d="M53 47 C61 32,76 24,90 24 C100 24,111 28,118 36 C126 24,141 19,154 19
             C171 19,185 29,190 44 C175 33,158 31,143 34 C132 20,109 17,92 23
             C76 28,62 37,53 47Z"
          fill={`url(#${highlightId})`}
        />
        <ellipse cx="124" cy="88" rx="86" ry="5" fill="white" fillOpacity="0.07" />
      </svg>
    </div>
  );
}

function CloudsLight({ isNight = false }: { isNight?: boolean }) {
  const o = isNight ? 0.10 : 0.14;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{RAIN_KEYFRAMES}</style>
      <div style={{ animation: "hegon-cloud-drift-a 20s ease-in-out infinite" }}>
        <CloudPuff left="-6%"  top="-32%" opacity={o}        scale={1.0}  blur={3.5} />
        <CloudPuff left="50%"  top="-26%" opacity={o * 0.80} scale={0.80} blur={3.0} flipX />
      </div>
    </div>
  );
}

function CloudsHeavy({ isNight = false, isStorm = false }: { isNight?: boolean; isStorm?: boolean }) {
  if (isStorm) {
    const back  = isNight ? "#1c2633" : "#243548";
    const mid   = isNight ? "#25364a" : "#324a62";
    const front = isNight ? "#364a63" : "#4f6986";
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <style>{RAIN_KEYFRAMES}</style>
        {/* Atmospheric storm dome */}
        <div
          className="absolute inset-x-[-18%] top-[-30%] h-[66%]"
          style={{
            background: isNight
              ? "radial-gradient(ellipse 88% 78% at 52% 42%, rgba(148,163,184,0.16), rgba(71,85,105,0.10) 45%, transparent 82%)"
              : "radial-gradient(ellipse 88% 78% at 52% 42%, rgba(191,219,254,0.18), rgba(100,116,139,0.09) 45%, transparent 82%)",
            filter: "blur(22px)",
          }}
        />
        <div style={{ animation: "hegon-cloud-drift-a 19s ease-in-out infinite" }}>
          <CloudPuff left="-20%" top="-28%" opacity={0.76} scale={1.62} fill={back}  blur={9.5} />
          <CloudPuff left="16%"  top="-33%" opacity={0.72} scale={1.38} fill={back}  blur={8.8} flipX />
          <CloudPuff left="54%"  top="-22%" opacity={0.66} scale={1.24} fill={back}  blur={8.4} />
        </div>
        <div style={{ animation: "hegon-cloud-drift-b 16s ease-in-out infinite" }}>
          <CloudPuff left="-10%" top="-16%" opacity={0.54} scale={1.18} fill={mid}   blur={6.4} />
          <CloudPuff left="32%"  top="-18%" opacity={0.50} scale={1.04} fill={mid}   blur={6.0} flipX />
          <CloudPuff left="68%"  top="-10%" opacity={0.42} scale={0.90} fill={mid}   blur={5.8} />
        </div>
        <div style={{ animation: "hegon-cloud-drift-c 13s ease-in-out infinite" }}>
          <CloudPuff left="-2%"  top="-6%"  opacity={0.30} scale={1.00} fill={front} blur={3.8} />
          <CloudPuff left="48%"  top="-10%" opacity={0.26} scale={0.86} fill={front} blur={3.6} flipX />
        </div>
        {/* Cool highlight */}
        <div
          className="absolute inset-x-[-12%] top-[-2%] h-[26%]"
          style={{
            background: isNight
              ? "linear-gradient(to bottom, rgba(165,180,252,0.09), rgba(125,211,252,0.05), transparent)"
              : "linear-gradient(to bottom, rgba(219,234,254,0.18), rgba(147,197,253,0.06), transparent)",
            filter: "blur(12px)",
            mixBlendMode: "screen",
            animation: "hegon-cloud-pulse 7s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-x-[-10%] top-[18%] h-[20%]"
          style={{
            background: "linear-gradient(to bottom, rgba(148,163,184,0.08), rgba(148,163,184,0.03), transparent)",
            filter: "blur(16px)",
          }}
        />
      </div>
    );
  }

  // Regular overcast/rain — soft white, subtly animated
  const back = isNight ? "#dbe4ef" : "#ffffff";
  const mid  = isNight ? "#edf2f7" : "#ffffff";
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{RAIN_KEYFRAMES}</style>
      <div
        className="absolute inset-x-[-16%] top-[-28%] h-[62%]"
        style={{
          background: isNight
            ? "radial-gradient(ellipse 88% 78% at 50% 42%, rgba(226,232,240,0.14), rgba(148,163,184,0.05) 48%, transparent 78%)"
            : "radial-gradient(ellipse 88% 78% at 50% 42%, rgba(255,255,255,0.20), rgba(226,232,240,0.06) 48%, transparent 78%)",
          filter: "blur(22px)",
        }}
      />
      <div style={{ animation: "hegon-cloud-drift-a 20s ease-in-out infinite" }}>
        <CloudPuff left="-16%" top="-26%" opacity={isNight ? 0.22 : 0.26} scale={1.40} fill={back} blur={8.2} />
        <CloudPuff left="22%"  top="-32%" opacity={isNight ? 0.18 : 0.22} scale={1.18} fill={back} blur={7.8} flipX />
        <CloudPuff left="60%"  top="-18%" opacity={isNight ? 0.15 : 0.18} scale={1.04} fill={back} blur={7.0} />
      </div>
      <div style={{ animation: "hegon-cloud-drift-b 17s ease-in-out infinite" }}>
        <CloudPuff left="-2%"  top="-10%" opacity={isNight ? 0.11 : 0.14} scale={1.00} fill={mid} blur={4.8} />
        <CloudPuff left="50%"  top="-13%" opacity={isNight ? 0.09 : 0.12} scale={0.86} fill={mid} blur={4.4} flipX />
      </div>
    </div>
  );
}

function RainStreaks() {
  const farDrops = [
    { left: "5%",  top: "-8%",  h: 34, delay: "0.10s", duration: "1.70s", opacity: 0.10 },
    { left: "15%", top: "-16%", h: 30, delay: "0.74s", duration: "1.84s", opacity: 0.09 },
    { left: "27%", top: "-10%", h: 38, delay: "0.38s", duration: "1.68s", opacity: 0.10 },
    { left: "40%", top: "-20%", h: 28, delay: "1.02s", duration: "1.88s", opacity: 0.08 },
    { left: "54%", top: "-14%", h: 36, delay: "0.22s", duration: "1.76s", opacity: 0.10 },
    { left: "68%", top: "-18%", h: 34, delay: "0.92s", duration: "1.82s", opacity: 0.09 },
    { left: "81%", top: "-9%",  h: 30, delay: "0.56s", duration: "1.74s", opacity: 0.09 },
    { left: "93%", top: "-15%", h: 32, delay: "1.18s", duration: "1.90s", opacity: 0.08 },
  ];
  const midDrops = [
    { left: "9%",  top: "-14%", h: 44, delay: "0.16s", duration: "1.18s", opacity: 0.17 },
    { left: "21%", top: "-22%", h: 48, delay: "0.78s", duration: "1.08s", opacity: 0.19 },
    { left: "34%", top: "-16%", h: 42, delay: "0.40s", duration: "1.12s", opacity: 0.18 },
    { left: "49%", top: "-25%", h: 50, delay: "0.98s", duration: "1.20s", opacity: 0.18 },
    { left: "63%", top: "-18%", h: 44, delay: "0.28s", duration: "1.10s", opacity: 0.17 },
    { left: "77%", top: "-12%", h: 46, delay: "0.88s", duration: "1.14s", opacity: 0.19 },
    { left: "89%", top: "-18%", h: 40, delay: "0.52s", duration: "1.08s", opacity: 0.16 },
  ];
  const nearDrops = [
    { left: "12%", top: "-18%", h: 60, delay: "0.30s", duration: "0.90s", opacity: 0.28 },
    { left: "26%", top: "-28%", h: 66, delay: "0.82s", duration: "0.86s", opacity: 0.32 },
    { left: "41%", top: "-22%", h: 62, delay: "0.14s", duration: "0.84s", opacity: 0.30 },
    { left: "56%", top: "-30%", h: 64, delay: "1.04s", duration: "0.92s", opacity: 0.29 },
    { left: "70%", top: "-24%", h: 68, delay: "0.46s", duration: "0.88s", opacity: 0.31 },
    { left: "85%", top: "-20%", h: 58, delay: "0.68s", duration: "0.84s", opacity: 0.27 },
  ];

  const renderDrop = (
    d: { left: string; top: string; h: number; delay: string; duration: string; opacity: number },
    animation: string, width: number, blur: number, shadowOpacity: number,
  ) => (
    <div
      key={`${animation}-${d.left}`}
      className="absolute rounded-full"
      style={{
        left: d.left, top: d.top, width, height: d.h, opacity: d.opacity,
        background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(219,234,254,0.20) 20%, rgba(191,219,254,0.62) 48%, rgba(125,211,252,0.95) 72%, rgba(255,255,255,0.22) 100%)",
        filter: `blur(${blur}px)`,
        animation: `${animation} ${d.duration} linear infinite`,
        animationDelay: d.delay,
        boxShadow: `0 0 10px rgba(125,211,252,${shadowOpacity})`,
      }}
    />
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <style>{RAIN_KEYFRAMES}</style>
      {/* Atmospheric shimmer veil */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(219,234,254,0.05), rgba(147,197,253,0.035) 30%, rgba(255,255,255,0.015) 58%, transparent)",
          animation: "hegon-rain-shimmer 5.6s ease-in-out infinite",
          mixBlendMode: "screen",
        }}
      />
      <div className="absolute inset-0">
        {farDrops.map((d) => renderDrop(d, "hegon-rain-far",  0.9, 1.50, 0.08))}
      </div>
      <div className="absolute inset-0">
        {midDrops.map((d) => renderDrop(d, "hegon-rain-mid",  1.3, 1.00, 0.12))}
      </div>
      <div className="absolute inset-0">
        {nearDrops.map((d) => renderDrop(d, "hegon-rain-near", 1.8, 0.75, 0.16))}
      </div>
      {/* Lower mist */}
      <div
        className="absolute inset-x-[-6%] bottom-0 h-[26%]"
        style={{
          background: "linear-gradient(to top, rgba(226,232,240,0.10), rgba(191,219,254,0.05), transparent)",
          filter: "blur(16px)",
        }}
      />
    </div>
  );
}

function SnowDots() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {SNOW_DOTS.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/60"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, filter: "blur(0.5px)" }}
        />
      ))}
    </div>
  );
}

function FogLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {[
        { top: "10%", left: "-10%", w: "70%", h: "20%", blur: 20, o: 0.07 },
        { top: "35%", left: "20%",  w: "80%", h: "18%", blur: 24, o: 0.05 },
        { top: "55%", left: "-5%",  w: "65%", h: "16%", blur: 20, o: 0.04 },
      ].map((f, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: f.top, left: f.left, width: f.w, height: f.h, opacity: f.o, filter: `blur(${f.blur}px)` }}
        />
      ))}
    </div>
  );
}

function WeatherScene({ condition, hour }: { condition: string; hour: number }) {
  const isNight   = hour >= 21 || hour < 5;
  const isDawn    = hour >= 5  && hour < 7;
  const isEvening = hour >= 17 && hour < 21;

  if (condition === "Thunderstorm") return <><CloudsHeavy isNight={isNight} isStorm /><RainStreaks /></>;
  if (condition === "Rain" || condition === "Drizzle") return <><CloudsHeavy isNight={isNight} isStorm /><RainStreaks /></>;
  if (condition === "Snow") return <><CloudsLight isNight={isNight} /><SnowDots /></>;

  if (condition === "Clouds") {
    // Night cloudy — stars visible through gaps, clouds on top
    if (isNight) return <><NightStars /><CloudsHeavy isNight /></>;
    return <CloudsHeavy />;
  }

  if (["Mist", "Fog", "Haze"].includes(condition)) return <FogLayer />;

  // Clear sky — stars at night, sun glow otherwise
  if (isNight)   return <NightStars />;
  if (isDawn)    return <SunGlow position="right" />;
  if (isEvening) return <SunGlow position="left" />;
  return <SunGlow position="right" />;
}

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const WEATHER_EMOJI: Record<string, string> = {
  Clear: "☀️", Clouds: "⛅", Rain: "🌧️", Drizzle: "🌦️",
  Thunderstorm: "⛈️", Snow: "❄️", Mist: "🌫️", Fog: "🌫️",
  Haze: "🌫️", Dust: "🌪️", Sand: "🌪️", Ash: "🌋",
  Squall: "💨", Tornado: "🌪️",
};

function getEmoji(condition: string, hour: number): string {
  const isNight = hour >= 21 || hour < 5;
  if (condition === "Clear" && isNight) return "🌙";
  return WEATHER_EMOJI[condition] ?? "🌡️";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  description: string;
  daily: Array<{ date: string; day: string; min: number; max: number; condition: string }>;
  hourly: Array<{ time: string; temp: number; condition: string }>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useWeather() {
  const { data, isLoading } = useQuery<WeatherData>({
    queryKey: ["weather"],
    queryFn: () => fetch("/api/weather").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  return { data: data ?? null, loading: isLoading };
}

// ─── Card shell ───────────────────────────────────────────────────────────────

function WeatherShell({
  theme,
  condition,
  hour,
  children,
}: {
  theme: WeatherTheme;
  condition: string;
  hour: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-zinc-950 flex-1 flex flex-col min-h-30`}>
      {/* atmospheric gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: theme.atmosphere }} />
      {/* directional light source */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: theme.glow }} />
      {/* scene elements (stars, clouds, sun, rain…) */}
      <WeatherScene condition={condition} hour={hour} />
      {/* top specular line */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(to right, transparent, ${theme.specular}, transparent)` }}
      />
      <div className="relative flex flex-col flex-1 p-3 gap-2">
        {children}
      </div>
    </div>
  );
}

// ─── Today variant ────────────────────────────────────────────────────────────

function TodayVariant({ data, theme, hour }: { data: WeatherData; theme: WeatherTheme; hour: number }) {
  return (
    <WeatherShell theme={theme} condition={data.condition} hour={hour}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.accent}`}>Weather</span>
        <span className="text-[10px] font-medium text-white/50">{data.city}</span>
      </div>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-[38px] leading-none">{getEmoji(data.condition, hour)}</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[30px] font-black text-white leading-none tracking-tight">{data.temp}°</span>
          <span className="text-[10px] text-white/65 capitalize leading-none">{data.description}</span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-white/40">Feels {data.feelsLike}°</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="flex items-center gap-1 text-[10px] text-white/45">
          <Droplets size={9} />{data.humidity}%
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/45">
          <Wind size={9} />{data.windSpeed} km/h
        </span>
      </div>
    </WeatherShell>
  );
}

// ─── Week variant ─────────────────────────────────────────────────────────────

function WeekVariant({ data, theme, hour }: { data: WeatherData; theme: WeatherTheme; hour: number }) {
  return (
    <WeatherShell theme={theme} condition={data.condition} hour={hour}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.accent}`}>Weather</span>
        <span className="text-[10px] font-medium text-white/50">{data.city}</span>
      </div>

      <div className="flex-1 flex items-center gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[38px] leading-none">{getEmoji(data.condition, hour)}</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[30px] font-black text-white leading-none tracking-tight">{data.temp}°</span>
            <span className="text-[10px] text-white/60 capitalize leading-none">{data.description}</span>
            <span className="text-[10px] font-semibold text-white/70">H:{data.tempMax}° L:{data.tempMin}°</span>
          </div>
        </div>

        <div className="w-px self-stretch bg-white/10" />

        <div className="flex-1 flex items-center justify-between">
          {data.daily.slice(0, 5).map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-medium text-white/38">{d.day}</span>
              <span className="text-[15px] leading-none">{getEmoji(d.condition, hour)}</span>
              <span className="text-[10px] font-semibold text-white/80">{d.max}°</span>
              <span className="text-[9px] text-white/35">{d.min}°</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="flex items-center gap-1 text-[10px] text-white/45">
          <Droplets size={9} />{data.humidity}%
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/45">
          <Wind size={9} />{data.windSpeed} km/h
        </span>
        <span className="text-[10px] text-white/30 ml-auto">Feels {data.feelsLike}°</span>
      </div>
    </WeatherShell>
  );
}

// ─── Mid variant ─────────────────────────────────────────────────────────────

function MidVariant({ data, theme, hour }: { data: WeatherData; theme: WeatherTheme; hour: number }) {
  const slots = data.hourly.slice(0, 5);

  return (
    <WeatherShell theme={theme} condition={data.condition} hour={hour}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.accent}`}>Weather</span>
        <div className="flex items-center gap-1">
          <MapPin size={9} className="text-white/35" />
          <span className="text-[10px] font-medium text-white/45">{data.city}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center gap-3">
        {/* Current weather */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[34px] leading-none">{getEmoji(data.condition, hour)}</span>
            <div>
              <p className="text-[28px] font-black text-white leading-none tracking-tight">{data.temp}°</p>
              <p className="text-[9px] text-white/55 capitalize leading-tight">{data.description}</p>
            </div>
          </div>
          <p className="text-[9px] text-white/40">
            Feels {data.feelsLike}°
          </p>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-white/10 shrink-0" />

        {/* Hourly slots */}
        <div className="flex-1 flex items-center justify-between gap-2">
          {slots.map((h) => (
            <div
              key={h.time}
              className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg bg-white/5"
            >
              <span className="text-[8px] text-white/35 font-medium">{h.time}</span>
              <span className="text-[13px] leading-none">
                {getEmoji(h.condition, parseInt(h.time.split(":")[0]))}
              </span>
              <span className="text-[10px] font-semibold text-white/80">{h.temp}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[10px] text-white/40">
          <Droplets size={9} />{data.humidity}%
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/40">
          <Wind size={9} />{data.windSpeed} km/h
        </span>
      </div>
    </WeatherShell>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  variant: "today" | "mid" | "week";
}

export default function TodayWeatherCard({ variant }: Props) {
  const { data, loading } = useWeather();
  const hour = new Date().getHours();

  if (loading || !data) {
    const theme = getWeatherTheme("Clear", hour);
    return (
      <WeatherShell theme={theme} condition="Clear" hour={hour}>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-white/20 animate-pulse">Loading weather…</span>
        </div>
      </WeatherShell>
    );
  }

  const theme = getWeatherTheme(data.condition, hour);

  if (variant === "today") return <TodayVariant data={data} theme={theme} hour={hour} />;
  if (variant === "mid") return <MidVariant data={data} theme={theme} hour={hour} />;
  return <WeekVariant data={data} theme={theme} hour={hour} />;
}
