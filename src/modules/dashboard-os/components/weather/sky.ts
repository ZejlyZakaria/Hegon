// Sky engine — pure math. The whole premium feel comes from one idea: the sky
// is NOT bucketed into "morning/evening", it interpolates continuously across
// real anchors positioned by the location's actual sunrise/sunset. So at the
// true local dusk, the tile is genuinely at dusk.

export type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
export function rgb([r, g, b]: RGB, a = 1) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ─── palettes (top → mid → bottom/horizon) ────────────────────────────────────

interface Palette { top: RGB; mid: RGB; bot: RGB; }
const P = (top: string, mid: string, bot: string): Palette => ({
  top: hexToRgb(top), mid: hexToRgb(mid), bot: hexToRgb(bot),
});

const NIGHT   = P("#050610", "#0a0e22", "#11162e");
const DAWN    = P("#192452", "#7c4a7a", "#e89a6a"); // indigo top, warm horizon
const SUNUP   = P("#2f63a8", "#8fb8d6", "#ecca9e");
const DAY     = P("#2769cf", "#67a3df", "#bfe0f4");
const SUNDOWN = P("#284a8c", "#c5854f", "#eaa35e");
const SUNSET  = P("#281f52", "#d05a45", "#f48851"); // fiery horizon
const DUSK    = P("#0e1130", "#39224f", "#7a3a55");

interface Anchor { m: number; pal: Palette; }

// Anchors as offsets from the day's real sun events.
function buildAnchors(sunrise: number, sunset: number): Anchor[] {
  const noon = (sunrise + sunset) / 2;
  return [
    { m: sunrise - 95, pal: NIGHT },
    { m: sunrise - 28, pal: DAWN },
    { m: sunrise + 34, pal: SUNUP },
    { m: noon,          pal: DAY },
    { m: sunset - 34,   pal: SUNDOWN },
    { m: sunset + 8,    pal: SUNSET },
    { m: sunset + 78,   pal: DUSK },
    { m: sunset + 150,  pal: NIGHT },
  ];
}

export interface SkyState {
  top: RGB; mid: RGB; bot: RGB;
  nightFactor: number; // 0 = full day, 1 = deep night (stars opacity)
  daylight: number;    // 0 = night, 1 = midday (sun strength)
}

// Continuous sky palette at a given local minute-of-day.
export function skyAt(minute: number, sunrise: number, sunset: number): SkyState {
  const anchors = buildAnchors(sunrise, sunset);
  const first = anchors[0], last = anchors[anchors.length - 1];

  let pal: Palette;
  if (minute <= first.m || minute >= last.m) {
    pal = NIGHT;
  } else {
    let i = 0;
    while (i < anchors.length - 1 && minute > anchors[i + 1].m) i++;
    const a = anchors[i], b = anchors[i + 1];
    const t = (minute - a.m) / (b.m - a.m);
    pal = {
      top: lerpRgb(a.pal.top, b.pal.top, t),
      mid: lerpRgb(a.pal.mid, b.pal.mid, t),
      bot: lerpRgb(a.pal.bot, b.pal.bot, t),
    };
  }

  // daylight: 0 before dawn, ramps over twilight, 1 around noon
  const daylight =
    smoothstep(sunrise - 30, sunrise + 45, minute) *
    (1 - smoothstep(sunset - 45, sunset + 30, minute));
  // night ramps in after dusk and out before dawn → drives star opacity
  const night =
    minute < sunrise
      ? 1 - smoothstep(sunrise - 70, sunrise - 5, minute)
      : smoothstep(sunset + 5, sunset + 70, minute);

  return { ...pal, nightFactor: clamp(night, 0, 1), daylight: clamp(daylight, 0, 1) };
}

// ─── celestial body (sun by day, moon by night) ───────────────────────────────

export interface Celestial {
  body: "sun" | "moon";
  x: number; // 0..100 (% across)
  y: number; // 0..100 (% from top) — arcs up at midday
  visible: boolean;
}

export function celestialAt(minute: number, sunrise: number, sunset: number): Celestial {
  if (minute >= sunrise && minute <= sunset) {
    const p = (minute - sunrise) / (sunset - sunrise);
    return { body: "sun", x: p * 100, y: 82 - Math.sin(p * Math.PI) * 64, visible: true };
  }
  // night arc: from sunset → next sunrise (wrap through midnight)
  const nightLen = 1440 - (sunset - sunrise);
  const since = minute > sunset ? minute - sunset : minute + (1440 - sunset);
  const p = clamp(since / nightLen, 0, 1);
  return { body: "moon", x: p * 100, y: 80 - Math.sin(p * Math.PI) * 58, visible: true };
}

// Local minute-of-day at the weather location, live (uses viewer UTC + tz offset).
export function localMinuteNow(timezoneOffsetSec: number): number {
  const utcMs = Date.now();
  const localSec = Math.floor(utcMs / 1000) + timezoneOffsetSec;
  return ((localSec % 86400) + 86400) % 86400 / 60;
}

// Convert a unix timestamp + tz offset to local minute-of-day.
export function unixToLocalMinute(unix: number, timezoneOffsetSec: number): number {
  return ((((unix + timezoneOffsetSec) % 86400) + 86400) % 86400) / 60;
}

// How much the sky flattens toward overcast grey for a condition.
export function overcastFactor(cond: SkyCondition): number {
  switch (cond) {
    case "thunderstorm": return 0.72;
    case "rain": return 0.58;
    case "drizzle": return 0.42;
    case "fog": return 0.5;
    case "snow": return 0.45;
    case "clouds": return 0.3;
    default: return 0;
  }
}

// Blend the clear-sky palette toward a desaturated, darker overcast — driven by
// condition + time of day (grey by day, near-black by night).
export function applyOvercast(sky: SkyState, cond: SkyCondition): { top: RGB; mid: RGB; bot: RGB } {
  const f = overcastFactor(cond);
  if (f === 0) return { top: sky.top, mid: sky.mid, bot: sky.bot };
  const greyDay: RGB = [116, 126, 142];
  const greyNight: RGB = [24, 28, 40];
  const grey = lerpRgb(greyDay, greyNight, sky.nightFactor);
  const darker = grey.map((v) => v * 0.76) as RGB;
  const lighter = grey.map((v) => Math.min(255, v * 1.14)) as RGB;
  return {
    top: lerpRgb(sky.top, darker, f),
    mid: lerpRgb(sky.mid, grey, f),
    bot: lerpRgb(sky.bot, lighter, f * 0.85), // horizon stays a touch brighter (mist)
  };
}

// Normalise OpenWeather `condition` (main) into a scene kind.
export type SkyCondition = "clear" | "clouds" | "rain" | "drizzle" | "thunderstorm" | "snow" | "fog";

export function toSkyCondition(condition: string | undefined): SkyCondition {
  switch (condition) {
    case "Clouds": return "clouds";
    case "Rain": return "rain";
    case "Drizzle": return "drizzle";
    case "Thunderstorm": return "thunderstorm";
    case "Snow": return "snow";
    case "Mist": case "Fog": case "Haze": case "Smoke": case "Dust": case "Sand": return "fog";
    default: return "clear";
  }
}
