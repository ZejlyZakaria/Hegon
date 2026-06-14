import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 20 requests per minute per IP
export const weatherRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix: "rl:weather",
});

// 120 requests per minute per IP. Each detail page open fires 2-3 TMDB calls
// (credits/cast, similar, season refresh), so 30/min throttled the owner's own
// browsing into 429s after ~10 quick opens. TMDB's real limit is ~3000/min, so
// 120 is still safe for the key while leaving plenty of headroom.
export const tmdbRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "rl:tmdb",
});

// 20 requests per minute per IP
export const tennisRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix: "rl:tennis",
});

// 10 requests per minute per IP — Google Books quota is 1000/day
export const booksRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:books",
});
