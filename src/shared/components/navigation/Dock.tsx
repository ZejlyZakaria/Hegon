"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Tv,
  Library,
  NotebookPen,
  Plane,
  CheckSquare,
  Target,
  Briefcase,
  Code2,
  Repeat2,
} from "lucide-react";
import { useInitOrg } from "@/shared/hooks/useInitOrg";
import { useUserSettings, useDemoStatus } from "@/modules/settings/hooks/useSettings";
import { TileFace } from "@/modules/dashboard-os/components/AppTile";
import { OS_APPS } from "@/modules/dashboard-os/config";

// ─── nav config ───────────────────────────────────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  href: string;
  activePrefix?: string;
  icon: React.ReactNode;
  accent: string;
  comingSoon?: boolean;
}

export const NAV_GROUPS: NavItem[][] = [
  [
    { key: "goals",   label: "Goals",   href: "/life/goals",   icon: <Target size={18} />,    accent: "#22c55e" },
    { key: "habits",  label: "Habits",  href: "/life/habits",  icon: <Repeat2 size={18} />,   accent: "#8b5cf6" },
    { key: "journal", label: "Journal", href: "/life/journal", icon: <NotebookPen size={18} />,  accent: "#f97316" },
    { key: "books",   label: "Books",   href: "/life/books",   icon: <Library size={18} />,   accent: "#0ea5e9" },
  ],
  [
    { key: "sport",    label: "Sport",    href: "/perso/sports/football", activePrefix: "/perso/sports",   icon: <Trophy size={18} />,   accent: "#10b981" },
    { key: "watching", label: "Watching", href: "/perso/watching/movies", activePrefix: "/perso/watching", icon: <Tv size={18} />,       accent: "var(--color-accent-watching-vivid)" },
    { key: "travel",   label: "Travel",   href: "/perso/travel",          icon: <Plane size={18} />,      accent: "#0ea5e9", comingSoon: true },
  ],
  [
    { key: "tasks",   label: "Tasks",    href: "/pro/tasks",   icon: <CheckSquare size={18} />, accent: "#71717a" },
    { key: "jobhunt", label: "Job Hunt", href: "/pro/jobhunt", icon: <Briefcase size={18} />,  accent: "#3b82f6", comingSoon: true },
    { key: "tech",    label: "Tech",     href: "/pro/tech",    icon: <Code2 size={18} />,      accent: "#06b6d4", comingSoon: true },
  ],
];

// section ambient colors — kept exported for Sidebar/other consumers
const SECTION_COLORS: Record<string, { from: string; glow: string }> = {
  "/dashboard":      { from: "rgba(96,165,250,0.08)",   glow: "#60a5fa" },
  "/life/goals":     { from: "rgba(34,197,94,0.08)",    glow: "#22c55e" },
  "/life/habits":    { from: "rgba(139,92,246,0.08)",   glow: "#8b5cf6" },
  "/life/journal":   { from: "rgba(249,115,22,0.08)",   glow: "#f97316" },
  "/life/books":     { from: "rgba(14,165,233,0.08)",   glow: "#0ea5e9" },
  "/perso/sports":   { from: "rgba(16,185,129,0.08)",   glow: "#10b981" },
  "/perso/watching": { from: "rgba(45,212,191,0.06)",   glow: "#2dd4bf" },
  "/perso/travel":   { from: "rgba(14,165,233,0.08)",   glow: "#0ea5e9" },
  "/pro/tasks":      { from: "rgba(113,113,122,0.12)",  glow: "#71717a" },
  "/pro/jobhunt":    { from: "rgba(59,130,246,0.08)",   glow: "#3b82f6" },
  "/pro/tech":       { from: "rgba(6,182,212,0.08)",    glow: "#06b6d4" },
};

export { SECTION_COLORS };

const DOCK_W = 76;

// ─── tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [y, setY] = useState(0);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const onEnter = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setY(r.top + r.height / 2);
    setArmed(true);
    timer.current = setTimeout(() => setVisible(true), 500);
  };

  const onLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    setVisible(false);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      <AnimatePresence>
        {armed && visible && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed z-30 pointer-events-none"
            style={{ left: DOCK_W + 2, top: y, transform: "translateY(-50%)" }}
          >
            <div className="bg-surface-3 border border-border-default text-text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── dock item ────────────────────────────────────────────────────────────────

function DockItem({
  itemKey,
  href,
  label,
  active,
  comingSoon,
}: {
  itemKey: string;
  href: string;
  label: string;
  active: boolean;
  comingSoon?: boolean;
}) {
  const app = OS_APPS[itemKey];
  if (!app) return null;

  const face = (
    <div className="group">
      <TileFace app={app} size="dock" active={active && !comingSoon} />
    </div>
  );

  const tooltipLabel = comingSoon ? `${label} — coming soon` : label;

  if (comingSoon) {
    return (
      <Tooltip label={tooltipLabel}>
        <div className="cursor-default">{face}</div>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={tooltipLabel}>
      <Link href={href} className="block focus:outline-none">
        {face}
      </Link>
    </Tooltip>
  );
}

// ─── dock ─────────────────────────────────────────────────────────────────────

export default function Dock() {
  const pathname = usePathname();
  const { data: userSettings } = useUserSettings();
  const { isReady: demoReady } = useDemoStatus();
  const hiddenModules = new Set(userSettings?.hidden_modules ?? []);
  // Wait for both prefs + demo status before rendering nav → no icon flash.
  const navReady = userSettings !== undefined && demoReady;

  useInitOrg();

  return (
    <aside
      className="relative z-20 hidden lg:flex shrink-0 items-center justify-center"
      style={{ width: DOCK_W }}
    >
      <nav className="glass flex max-h-[calc(100dvh-20px)] flex-col items-center gap-2.5 overflow-y-auto rounded-[26px] px-2.5 py-3.5 custom-scrollbar-hide">
        {/* logo */}
        <Link href="/dashboard" className="relative h-7 w-7 shrink-0 opacity-90 transition-opacity hover:opacity-100">
          <Image src="/logo/Hegon_white_logo.png" alt="HEGON" fill sizes="28px" priority className="object-contain" />
        </Link>

        {navReady && (
          <>
            {/* Dashboard — always on for the owner (it's the home); for the demo it
                follows hidden_modules, so the owner controls it from Demo & Sharing. */}
            {!hiddenModules.has("dashboard") && (
              <>
                <div className="h-px w-7 bg-white/12" />
                <DockItem
                  itemKey="dashboard"
                  href="/dashboard"
                  label="Home"
                  active={pathname === "/dashboard"}
                />
              </>
            )}

            {NAV_GROUPS.map((group, gi) => {
              // Hidden modules off for everyone; coming-soon modules never show in
              // the dock (they stay on the dashboard grid, dimmed).
              const items = group.filter(
                (item) => !hiddenModules.has(item.key) && !item.comingSoon,
              );
              if (items.length === 0) return null;
              return (
                <div key={gi} className="flex flex-col items-center gap-2.5">
                  <div className="h-px w-7 bg-white/12" />
                  {items.map((item) => (
                    <DockItem
                      key={item.key}
                      itemKey={item.key}
                      href={item.href}
                      label={item.label}
                      active={pathname.startsWith(item.activePrefix ?? item.href)}
                      comingSoon={item.comingSoon}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
