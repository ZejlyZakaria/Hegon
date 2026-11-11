import { unstable_cache } from "next/cache";
import { fetchAnimeThemes } from "./anime-themes-provider";

// Only successful, validated results (including a real empty catalogue) are cached.
// Next retains successful cached data during revalidation; a rejected cold read stays an error.
const cachedThemes = unstable_cache(fetchAnimeThemes, ["watching-anime-themes-v1"], { revalidate: 86400 });
const failures = new Map<string, number>();
const pending = new Map<string, ReturnType<typeof cachedThemes>>();

export async function getAnimeThemes(title: string, year: number | null) {
  const key = JSON.stringify([title, year]);
  if ((failures.get(key) ?? 0) > Date.now()) throw new Error("Themes temporarily unavailable");
  const existing = pending.get(key);
  if (existing) return existing;
  const request = cachedThemes(title, year).catch((error: unknown) => {
    // A small process-local circuit breaker supplements the durable successful cache.
    if (failures.size >= 200) failures.delete(failures.keys().next().value!);
    failures.set(key, Date.now() + 60000);
    throw error;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
