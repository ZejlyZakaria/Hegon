import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { weatherRatelimit } from "@/shared/lib/ratelimit";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  // Local JWT verification via getClaims() (asymmetric keys → no network round-trip;
  // falls back to getUser() otherwise). Same perf fix as middleware — see CLAUDE.md §8.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { success } = await weatherRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Weather API key not configured" }, { status: 500 });
  }

  // Location — lat/lon params win; default to Fès (owner's city) until the
  // Settings location picker lands. queryKey on the client includes the coords.
  const sp = request.nextUrl.searchParams;
  const lat = sp.get("lat");
  const lon = sp.get("lon");
  const place =
    lat && lon
      ? `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      : `lat=34.0331&lon=-4.9998`; // Fès, Morocco

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?${place}&units=metric&appid=${key}`, {
        next: { revalidate: 600 },
      }),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?${place}&units=metric&cnt=40&appid=${key}`, {
        next: { revalidate: 600 },
      }),
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      return NextResponse.json({ error: "Failed to fetch weather data" }, { status: 502 });
    }

    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    // Group 3h forecast entries into daily summaries
    const dailyMap = new Map<string, { temps: number[]; condition: string }>();
    for (const item of forecast.list) {
      const date: string = item.dt_txt.split(" ")[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { temps: [], condition: item.weather[0].main });
      }
      dailyMap.get(date)!.temps.push(item.main.temp);
    }

    const daily = Array.from(dailyMap.entries())
      .slice(0, 7)
      .map(([date, data]) => {
        const d = new Date(date);
        return {
          date,
          day: DAYS[d.getUTCDay()],
          min: Math.round(Math.min(...data.temps)),
          max: Math.round(Math.max(...data.temps)),
          condition: data.condition,
        };
      });

    const nowTs = Math.floor(Date.now() / 1000);
    const hourly = forecast.list
      .filter((item: { dt: number }) => item.dt > nowTs)
      .slice(0, 5)
      .map((item: { dt_txt: string; main: { temp: number }; weather: Array<{ main: string }> }) => ({
        time: item.dt_txt.split(" ")[1].slice(0, 5),
        temp: Math.round(item.main.temp),
        condition: item.weather[0].main,
      }));

    // Day high/low — OpenWeather's current `temp_min/max` is the spread across the
    // city's stations (≈ current temp for a point), NOT the day's range. Use the
    // next 24h of forecast (8 × 3h) folded with the current reading, so there's
    // always a real day/night spread regardless of the time of day.
    const curTemp = Math.round(current.main.temp);
    const next24 = (forecast.list as Array<{ main: { temp: number } }>).slice(0, 8).map((i) => i.main.temp);
    const tempMax = Math.round(Math.max(curTemp, ...next24));
    const tempMin = Math.round(Math.min(curTemp, ...next24));

    return NextResponse.json({
      city: current.name,
      temp: curTemp,
      feelsLike: Math.round(current.main.feels_like),
      tempMin,
      tempMax,
      humidity: current.main.humidity,
      windSpeed: Math.round(current.wind.speed * 3.6),
      condition: current.weather[0].main,
      description: (current.weather[0].description as string).replace(/^\w/, (c: string) => c.toUpperCase()),
      // Sun timing + tz offset (seconds) — drives the continuous, reality-locked sky.
      sunrise: current.sys?.sunrise ?? null,
      sunset: current.sys?.sunset ?? null,
      timezone: current.timezone ?? 0,
      dt: current.dt ?? Math.floor(Date.now() / 1000),
      daily,
      hourly,
    });
  } catch {
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 500 });
  }
}
