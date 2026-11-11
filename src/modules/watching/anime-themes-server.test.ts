import { afterEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./anime-themes-provider", () => ({ fetchAnimeThemes: provider }));
import { getAnimeThemes } from "./anime-themes-server";
afterEach(() => { vi.useRealTimers();provider.mockReset(); });
it("coalesces concurrent reads and cools down failure without storing an empty success", async () => {
  vi.useFakeTimers();provider.mockRejectedValue(new Error("down"));
  const results = await Promise.allSettled([getAnimeThemes("cooldown-test", null), getAnimeThemes("cooldown-test", null)]);
  expect(results.every(r => r.status === "rejected")).toBe(true);expect(provider).toHaveBeenCalledTimes(1);
  await expect(getAnimeThemes("cooldown-test", null)).rejects.toThrow();expect(provider).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(60001);provider.mockResolvedValue([]);
  await expect(getAnimeThemes("cooldown-test", null)).resolves.toEqual([]);expect(provider).toHaveBeenCalledTimes(2);
});
