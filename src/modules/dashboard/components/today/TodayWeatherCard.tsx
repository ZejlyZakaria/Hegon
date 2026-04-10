"use client";

import { useQuery } from "@tanstack/react-query";
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

// ─── Realistic SVG cloud ──────────────────────────────────────────────────────
// Multiple overlapping ellipses = natural cumulus puff shape

function CloudPuff({
  left, top, opacity, scale = 1, flipX = false,
}: {
  left: string; top: string; opacity: number; scale?: number; flipX?: boolean;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left, top, opacity,
        transform: `scale(${scale}) ${flipX ? "scaleX(-1)" : ""}`,
        transformOrigin: "top left",
        filter: "blur(1.5px)",
      }}
      aria-hidden
    >
      <svg width="190" height="72" viewBox="0 0 190 72" fill="white">
        {/* flat base */}
        <ellipse cx="95" cy="62" rx="86" ry="10" />
        {/* main body */}
        <ellipse cx="54"  cy="48" rx="38" ry="23" />
        <ellipse cx="100" cy="42" rx="36" ry="26" />
        <ellipse cx="146" cy="50" rx="32" ry="20" />
        {/* top bumps */}
        <ellipse cx="76"  cy="30" rx="26" ry="19" />
        <ellipse cx="116" cy="28" rx="24" ry="18" />
        <ellipse cx="95"  cy="20" rx="18" ry="14" />
      </svg>
    </div>
  );
}

function CloudsLight({ isNight = false }: { isNight?: boolean }) {
  const o = isNight ? 0.11 : 0.15;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <CloudPuff left="-6%"  top="-32%" opacity={o}          scale={0.95} />
      <CloudPuff left="52%"  top="-26%" opacity={o * 0.80}   scale={0.75} flipX />
    </div>
  );
}

function CloudsHeavy({ isNight = false }: { isNight?: boolean }) {
  const o = isNight ? 0.14 : 0.19;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <CloudPuff left="-8%"  top="-28%" opacity={o}          scale={1.05} />
      <CloudPuff left="36%"  top="-22%" opacity={o * 0.88}   scale={0.90} flipX />
      <CloudPuff left="62%"  top="-18%" opacity={o * 0.75}   scale={0.80} />
    </div>
  );
}

function RainStreaks() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
      style={{
        background:
          "repeating-linear-gradient(108deg, transparent, transparent 7px, rgba(147,197,253,0.055) 7px, rgba(147,197,253,0.055) 8px)",
      }}
    />
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

  if (condition === "Thunderstorm") return <><CloudsHeavy isNight={isNight} /><RainStreaks /></>;
  if (condition === "Rain" || condition === "Drizzle") return <><CloudsHeavy isNight={isNight} /><RainStreaks /></>;
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
    staleTime: 30 * 60 * 1000,
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
          <span className="text-[11px] font-semibold text-white/80">H:{data.tempMax}° L:{data.tempMin}°</span>
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
            H:{data.tempMax}°&nbsp;&nbsp;L:{data.tempMin}°&nbsp;&nbsp;·&nbsp;&nbsp;Feels {data.feelsLike}°
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
