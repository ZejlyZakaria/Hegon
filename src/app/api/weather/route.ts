import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { weatherRatelimit } from "@/shared/lib/ratelimit";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=Paris&units=metric&appid=${key}`, {
        next: { revalidate: 600 },
      }),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Paris&units=metric&cnt=40&appid=${key}`, {
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

    return NextResponse.json({
      city: current.name,
      temp: Math.round(current.main.temp),
      feelsLike: Math.round(current.main.feels_like),
      tempMin: Math.round(current.main.temp_min),
      tempMax: Math.round(current.main.temp_max),
      humidity: current.main.humidity,
      windSpeed: Math.round(current.wind.speed * 3.6),
      condition: current.weather[0].main,
      description: (current.weather[0].description as string).replace(/^\w/, (c: string) => c.toUpperCase()),
      daily,
      hourly,
    });
  } catch {
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 500 });
  }
}
