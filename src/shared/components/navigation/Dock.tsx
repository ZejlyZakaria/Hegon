"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Trophy,
  Tv,
  Library,
  BookOpen,
  Plane,
  Dumbbell,
  CheckSquare,
  Target,
  Briefcase,
  Code2,
  Settings,
  LogOut,
  Moon,
  Sun,
  Repeat2,
} from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useTheme } from "next-themes";
import { signOut } from "@/infrastructure/auth/actions";
import { useInitOrg } from "@/shared/hooks/useInitOrg";

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

const NAV_GROUPS: NavItem[][] = [
  [
    { key: "goals",   label: "Goals",   href: "/life/goals",   icon: <Target size={20} />,    accent: "#22c55e" },
    { key: "habits",  label: "Habits",  href: "/life/habits",  icon: <Repeat2 size={20} />,   accent: "#f43f5e" },
    { key: "journal", label: "Journal", href: "/life/journal", icon: <BookOpen size={20} />,  accent: "#f97316" },
    { key: "books",   label: "Books",   href: "/life/books",   icon: <Library size={20} />,   accent: "#0ea5e9" },
  ],
  [
    { key: "sport",    label: "Sport",    href: "/perso/sports/football", activePrefix: "/perso/sports",   icon: <Trophy size={20} />,   accent: "#10b981" },
    { key: "watching", label: "Watching", href: "/perso/watching/movies", activePrefix: "/perso/watching", icon: <Tv size={20} />,       accent: "#8b5cf6" },
    { key: "travel",   label: "Travel",   href: "/perso/travel",          icon: <Plane size={20} />,     accent: "#0ea5e9", comingSoon: true },
    { key: "fitness",  label: "Fitness",  href: "/perso/fitness",         icon: <Dumbbell size={20} />,  accent: "#f97316", comingSoon: true },
  ],
  [
    { key: "tasks",   label: "Tasks",    href: "/pro/tasks",   icon: <CheckSquare size={20} />, accent: "#71717a" },
    { key: "jobhunt", label: "Job Hunt", href: "/pro/jobhunt", icon: <Briefcase size={20} />,  accent: "#3b82f6", comingSoon: true },
    { key: "tech",    label: "Tech",     href: "/pro/tech",    icon: <Code2 size={20} />,      accent: "#06b6d4", comingSoon: true },
  ],
];

// ─── section ambient colors ───────────────────────────────────────────────────

const SECTION_COLORS: Record<string, { from: string; glow: string }> = {
  "/dashboard":      { from: "rgba(96,165,250,0.08)",   glow: "#60a5fa" },
  "/life/goals":     { from: "rgba(34,197,94,0.08)",    glow: "#22c55e" },
  "/life/habits":    { from: "rgba(244,63,94,0.08)",    glow: "#f43f5e" },
  "/life/journal":   { from: "rgba(249,115,22,0.08)",   glow: "#f97316" },
  "/life/books":     { from: "rgba(14,165,233,0.08)",   glow: "#0ea5e9" },
  "/perso/sports":   { from: "rgba(16,185,129,0.08)",   glow: "#10b981" },
  "/perso/watching": { from: "rgba(139,92,246,0.08)",   glow: "#8b5cf6" },
  "/perso/travel":   { from: "rgba(14,165,233,0.08)",   glow: "#0ea5e9" },
  "/perso/fitness":  { from: "rgba(244,63,94,0.08)",    glow: "#f43f5e" },
  "/pro/tasks":      { from: "rgba(113,113,122,0.12)",  glow: "#71717a" },
  "/pro/jobhunt":    { from: "rgba(59,130,246,0.08)",   glow: "#3b82f6" },
  "/pro/tech":       { from: "rgba(6,182,212,0.08)",    glow: "#06b6d4" },
};

const getSectionColor = (p: string) => {
  for (const [path, colors] of Object.entries(SECTION_COLORS)) {
    if (p.startsWith(path)) return colors;
  }
  return { from: "rgba(99,102,241,0.04)", glow: "#6366f1" };
};

const DOCK_W = 56;

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
    <div ref={ref} className="relative w-full" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      <AnimatePresence>
        {armed && visible && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[9999] pointer-events-none"
            style={{ left: DOCK_W + 8, top: y, transform: "translateY(-50%)" }}
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
  href,
  icon,
  label,
  active,
  accent,
  comingSoon,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  accent: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <div className="relative px-2 py-0.5">
      {/* active left bar */}
      {active && !comingSoon && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ backgroundColor: accent }}
        />
      )}
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-100",
          comingSoon
            ? "text-text-tertiary opacity-25 cursor-not-allowed"
            : active
              ? "bg-white/[0.07]"
              : "text-text-tertiary hover:text-text-primary hover:bg-white/5 cursor-pointer",
        )}
        style={active && !comingSoon ? { color: accent } : undefined}
      >
        {icon}
      </div>
    </div>
  );

  const tooltipLabel = comingSoon ? `${label} — coming soon` : label;

  if (comingSoon) {
    return <Tooltip label={tooltipLabel}>{inner}</Tooltip>;
  }

  return (
    <Tooltip label={tooltipLabel}>
      <Link href={href} className="block">
        {inner}
      </Link>
    </Tooltip>
  );
}

// ─── profile menu ─────────────────────────────────────────────────────────────

function ProfileMenu({
  open,
  onClose,
  anchorRef,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  userEmail: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ y: 0 });
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ y: r.top });
  }, [open, anchorRef]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    if (open) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, x: -6, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -6, scale: 0.97 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
          className="fixed z-[9999] bg-surface-3 backdrop-blur-xl border border-border-strong rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: DOCK_W + 8,
            bottom: `calc(100vh - ${pos.y}px + 4px)`,
            minWidth: 200,
          }}
        >
          {/* user info */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              Z
            </div>
            <p className="text-[11px] text-text-tertiary truncate">
              {userEmail ?? "—"}
            </p>
          </div>

          {/* items */}
          <div className="p-1.5">
            <Link href="/settings" onClick={onClose}>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer group">
                <Settings size={14} className="text-text-tertiary group-hover:text-text-secondary" />
                <span className="text-[13px] text-text-secondary group-hover:text-text-primary">Settings</span>
              </div>
            </Link>

            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer group"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? (
                  <Sun size={14} className="text-text-tertiary group-hover:text-text-secondary" />
                ) : (
                  <Moon size={14} className="text-text-tertiary group-hover:text-text-secondary" />
                )}
                <span className="text-[13px] text-text-secondary group-hover:text-text-primary">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </div>
              <div className={cn("w-8 h-4 rounded-full relative transition-colors duration-200", theme === "dark" ? "bg-violet-600" : "bg-surface-3")}>
                <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200", theme === "dark" ? "left-4" : "left-0.5")} />
              </div>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                onClick={onClose}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer group"
              >
                <LogOut size={14} className="text-text-tertiary group-hover:text-red-400" />
                <span className="text-[13px] text-text-secondary group-hover:text-red-400">Sign out</span>
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── dock ─────────────────────────────────────────────────────────────────────

export default function Dock() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { from, glow } = getSectionColor(pathname);

  useInitOrg();

  useEffect(() => {
    import("@/infrastructure/supabase/client").then(({ createClient }) => {
      createClient()
        .auth.getUser()
        .then(({ data }) => setUserEmail(data.user?.email ?? null));
    });
  }, []);

  return (
    <>
      <ProfileMenu
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        anchorRef={profileRef}
        userEmail={userEmail}
      />

      <aside
        className="relative flex flex-col h-screen shrink-0 overflow-hidden border-r border-white/5"
        style={{ width: DOCK_W, background: "#0e0e10" }}
      >
        {/* ambient glow — top radial */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 220% 30% at 50% 0%, ${from.replace("0.08", "0.30")}, transparent 55%)`,
          }}
        />
        {/* ambient glow — bottom fade */}
        <div
          className="absolute bottom-0 inset-x-0 h-24 pointer-events-none transition-all duration-700"
          style={{
            background: `linear-gradient(to top, ${from.replace("0.08", "0.12")}, transparent)`,
          }}
        />
        {/* top glow line */}
        <div
          className="absolute top-0 inset-x-0 h-px pointer-events-none transition-all duration-500"
          style={{
            background: `linear-gradient(90deg, transparent, ${glow}80, transparent)`,
          }}
        />

        {/* ── logo ── */}
        <div className="h-14 flex items-center justify-center shrink-0 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg overflow-hidden relative">
            <Image
              src="/logo/Hegon_black_logo2.png"
              alt="HEGON"
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>

        {/* ── nav ── */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar-hide">
          {/* Dashboard */}
          <DockItem
            href="/dashboard"
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={pathname === "/dashboard"}
            accent="#60a5fa"
          />

          {/* Groups */}
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              <div className="h-px bg-white/[0.06] mx-3 my-2" />
              {group.map((item) => (
                <DockItem
                  key={item.key}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(item.activePrefix ?? item.href)}
                  accent={item.accent}
                  comingSoon={item.comingSoon}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ── footer ── */}
        <div className="relative border-t border-white/5 h-14 flex items-center justify-center shrink-0">
          <div
            ref={profileRef}
            onClick={() => setProfileOpen((p) => !p)}
            className={cn(
              "w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-indigo-600",
              "flex items-center justify-center text-xs font-bold text-white cursor-pointer",
              "transition-all duration-150",
              profileOpen
                ? "ring-2 ring-white/25"
                : "hover:ring-2 hover:ring-white/15",
            )}
          >
            Z
          </div>
        </div>
      </aside>
    </>
  );
}
