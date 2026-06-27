"use client";

import { usePathname } from "next/navigation";
import { useMounted } from "@/shared/hooks/useMounted";
import { HomeWallpaper } from "./HomeWallpaper";
import { useDashboardLayout } from "../store";

// Client gate — the (main) layout is a server component that doesn't re-render on
// client navigation, so a server-side `isDashboard` check would leave the
// wallpaper mounted across modules. usePathname re-evaluates on every nav, so the
// wallpaper only ever shows on the dashboard.
export function DashboardWallpaper() {
  const pathname = usePathname();
  const mounted = useMounted();
  const wallpaper = useDashboardLayout((s) => s.wallpaper);
  if (!pathname?.startsWith("/dashboard")) return null;
  // before mount the persisted choice isn't hydrated → render the default preset
  if (!mounted) return <HomeWallpaper />;
  return <HomeWallpaper id={wallpaper.id} imageUrl={wallpaper.imageUrl} blur={wallpaper.blur} />;
}
