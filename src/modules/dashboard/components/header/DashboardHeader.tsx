"use client";

import { motion } from "framer-motion";

const PARIS_TZ = "Europe/Paris";

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 22) return "Good evening";
  return "Good night";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: PARIS_TZ,
  });
}

export default function DashboardHeader({ userName }: { userName: string }) {
  const now = new Date();
  const hour = parseInt(
    now.toLocaleTimeString("en-US", { hour: "numeric", hour12: false, timeZone: PARIS_TZ }),
    10,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <h1
        className="text-2xl font-light tracking-tight text-text-primary"
        suppressHydrationWarning
      >
        {formatDate(now)}
      </h1>
      <p className="mt-0.5 text-sm text-text-tertiary" suppressHydrationWarning>
        {getGreeting(hour)}, {userName}.
      </p>
    </motion.div>
  );
}
