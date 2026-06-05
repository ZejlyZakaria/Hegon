"use client";

import { useEffect } from "react";
import { useHabits } from "../hooks/useHabits";
import { useHabitsToday } from "../hooks/useHabitsToday";
import { useHabitsUIStore } from "../store";
import { computeAchievements } from "../achievements";
import { getTodayStr } from "../utils";
import { toast } from "@/shared/utils/toast";
import { AchievementGrid } from "@/shared/components/achievements/AchievementGrid";

const ACCENT = "var(--color-accent-habits-vivid)";

export function HabitsAchievements() {
  const { data: allHabits = [] } = useHabits();
  const { recentCompletions } = useHabitsToday();
  const today = getTodayStr();

  const achievements = computeAchievements({ habits: allHabits, recentCompletions, today });
  const unlockedKeys = achievements.filter((a) => a.unlocked).map((a) => a.key);
  const unlockedKey = unlockedKeys.join(",");

  const seen = useHabitsUIStore((s) => s.seenAchievements);
  const markSeen = useHabitsUIStore((s) => s.markAchievementsSeen);

  useEffect(() => {
    if (allHabits.length === 0) return;
    // First visit: silently baseline pre-existing achievements (no toast storm).
    if (seen.length === 0) {
      if (unlockedKeys.length) markSeen(unlockedKeys);
      return;
    }
    const fresh = unlockedKeys.filter((k) => !seen.includes(k));
    if (fresh.length > 0) {
      fresh.forEach((k) => {
        const a = achievements.find((x) => x.key === k);
        if (a) toast.success(`Achievement unlocked — ${a.name}`);
      });
      markSeen(Array.from(new Set([...seen, ...unlockedKeys])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedKey, allHabits.length]);

  return <AchievementGrid achievements={achievements} accent={ACCENT} />;
}
