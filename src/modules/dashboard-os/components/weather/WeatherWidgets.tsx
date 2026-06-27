"use client";

import { cn } from "@/shared/utils/utils";
import { useMounted } from "@/shared/hooks/useMounted";
import { WeatherSky } from "./WeatherSky";
import { useWeather, type WeatherData } from "./useWeather";

const EMOJI: Record<string, string> = {
  Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Drizzle: "🌦️", Thunderstorm: "⛈️",
  Snow: "❄️", Mist: "🌫️", Fog: "🌫️", Haze: "🌫️",
};

const TILE = "relative overflow-hidden rounded-[22px]";
const RIM = {
  boxShadow:
    "inset 0 1px 0 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 34px -10px rgba(0,0,0,0.6)",
} as const;

// Data comes from a client-only persisted cache (localStorage), so the server
// has no snapshot → gate the text behind mount to avoid a hydration mismatch.
// (The sky has its own mount gate.)
function useMountedData(): WeatherData | undefined {
  const { data } = useWeather();
  const mounted = useMounted();
  return mounted ? data : undefined;
}

function Sky({ data }: { data?: WeatherData }) {
  return (
    <WeatherSky
      condition={data?.condition}
      sunrise={data?.sunrise}
      sunset={data?.sunset}
      timezone={data?.timezone ?? 0}
    />
  );
}

// ─── Small (glance) ───────────────────────────────────────────────────────────

export function WeatherWidget() {
  const d = useMountedData();

  return (
    <div className={cn(TILE, "h-full w-full")} style={RIM}>
      <Sky data={d} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(0,0,0,0.42), transparent 62%)" }} />
      <div className="relative flex h-full flex-col justify-between p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="truncate text-[11px] font-medium text-white/85 drop-shadow">{d?.city ?? "—"}</span>
          {d && <span className="shrink-0 text-[10px] text-white/65 drop-shadow">H:{d.tempMax}° L:{d.tempMin}°</span>}
        </div>
        <div>
          <p className="text-[36px] font-semibold leading-none drop-shadow-md">{d ? `${d.temp}°` : "—"}</p>
          <p className="mt-1 truncate text-[12px] text-white/80 drop-shadow">{d?.description ?? "Loading…"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Medium (today + hourly) ──────────────────────────────────────────────────

export function WeatherWidgetM() {
  const d = useMountedData();

  return (
    <div className={cn(TILE, "col-span-2 h-37")} style={RIM}>
      <Sky data={d} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(0,0,0,0.5), rgba(0,0,0,0.12) 55%, transparent)" }} />
      <div className="relative flex h-full p-4 text-white">
        <div className="flex w-[44%] shrink-0 flex-col justify-between">
          <span className="truncate text-[11px] font-medium text-white/85 drop-shadow">{d?.city ?? "—"}</span>
          <div>
            <p className="text-[40px] font-semibold leading-none drop-shadow-md">{d ? `${d.temp}°` : "—"}</p>
            <p className="mt-1 truncate text-[12px] text-white/80 drop-shadow">{d?.description ?? "Loading…"}</p>
          </div>
          {d && (
            <p className="text-[10px] text-white/60 drop-shadow">
              Feels {d.feelsLike}° · H:{d.tempMax}° L:{d.tempMin}°
            </p>
          )}
        </div>

        <div className="flex flex-1 items-center justify-between gap-1 pl-3">
          {(d?.hourly ?? []).slice(0, 5).map((h) => (
            <div key={h.time} className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-white/10 py-2 backdrop-blur-sm">
              <span className="text-[9px] text-white/60">{h.time}</span>
              <span className="text-[14px] leading-none">{EMOJI[h.condition] ?? "🌡️"}</span>
              <span className="text-[11px] font-semibold text-white/90">{h.temp}°</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
