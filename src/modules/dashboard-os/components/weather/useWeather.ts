"use client";

import { useQuery } from "@tanstack/react-query";

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  description: string;
  sunrise: number | null;
  sunset: number | null;
  timezone: number;
  dt: number;
  daily: { date: string; day: string; min: number; max: number; condition: string }[];
  hourly: { time: string; temp: number; condition: string }[];
}

export interface WeatherLoc { lat: number; lon: number; label: string }

// Owner's city until the Settings location picker lands. A saved override
// (localStorage now, user_settings later) wins.
const DEFAULT_LOC: WeatherLoc = { lat: 34.0331, lon: -4.9998, label: "Fès" };
const LOC_KEY = "hegon-weather-loc";

export function getWeatherLoc(): WeatherLoc {
  if (typeof window === "undefined") return DEFAULT_LOC;
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (raw) return JSON.parse(raw) as WeatherLoc;
  } catch {}
  return DEFAULT_LOC;
}

export function setWeatherLoc(loc: WeatherLoc) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch {}
}

// v2 — bumped when the response shape changes (e.g. H/L fix) so old persisted
// snapshots are dropped and a fresh fetch repopulates.
function cacheKey(lat: number, lon: number) {
  return `hegon-weather:v2:${lat.toFixed(2)},${lon.toFixed(2)}`;
}
function readCache(lat: number, lon: number): { data: WeatherData; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(lat: number, lon: number, data: WeatherData) {
  try { localStorage.setItem(cacheKey(lat, lon), JSON.stringify({ data, at: Date.now() })); } catch {}
}

export function useWeather() {
  const loc = getWeatherLoc();
  const cached = readCache(loc.lat, loc.lon);

  return useQuery<WeatherData>({
    queryKey: ["weather", loc.lat, loc.lon],
    queryFn: async () => {
      const data = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`).then((r) => r.json());
      writeCache(loc.lat, loc.lon, data);
      return data;
    },
    // Instant on load from the persisted snapshot, then revalidate (SWR), and
    // keep itself fresh on a timer + on focus — no manual reload ever needed.
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: 12 * 60 * 1000,
    refetchOnWindowFocus: true,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
  });
}
