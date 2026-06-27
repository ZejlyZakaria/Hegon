"use client";

import { usePathname } from "next/navigation";
import { HomeWallpaper } from "./HomeWallpaper";

// Client gate — the (main) layout is a server component that doesn't re-render on
// client navigation, so a server-side `isDashboard` check would leave the
// wallpaper mounted across modules. usePathname re-evaluates on every nav, so the
// wallpaper only ever shows on the dashboard.
export function DashboardWallpaper() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/dashboard")) return null;
  return <HomeWallpaper />;
}
