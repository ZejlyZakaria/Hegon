"use client";

import { useState, useEffect } from "react";

interface DashboardHeaderProps {
  userName: string;
  hasTask: boolean;
  hasMatch: boolean;
}

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 22) return "Good evening";
  return "Good night";
}

function getSubtitle(hasTask: boolean, hasMatch: boolean): string {
  if (hasTask && hasMatch) return "Your day is packed — let's make it count.";
  if (hasTask) return "One thing to conquer today.";
  if (hasMatch) return "Light day — enjoy the game tonight.";
  return "Nothing urgent today. Make it yours.";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DashboardHeader({ userName, hasTask, hasMatch }: DashboardHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    setMounted(true);
  }, []);

  const greeting = now ? getGreeting(now.getHours()) : "";
  const subtitle = getSubtitle(hasTask, hasMatch);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white tracking-tight">
        {mounted && now ? formatDate(now) : ""}
      </h1>
      <p className="text-xs text-zinc-500 mt-0.5">
        {mounted ? `${greeting}, ${userName}` : ""}&nbsp;&nbsp;·&nbsp;&nbsp;{subtitle}
      </p>
    </div>
  );
}