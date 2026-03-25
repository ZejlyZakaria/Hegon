"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Trophy,
  Tv,
  BookOpen,
  Plane,
  Dumbbell,
  CheckSquare,
  Target,
  Briefcase,
  Code2,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronUp,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { useTheme } from "next-themes";
import { signOut } from "@/app/actions/auth-actions";

// ─── types ────────────────────────────────────────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  accent: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─── config ───────────────────────────────────────────────────────────────────

const NAV: NavGroup[] = [
  {
    label: "Perso",
    items: [
      {
        key: "sport",
        label: "Sport",
        href: "/perso/sports",
        icon: <Trophy size={15} />,
        accent: "#10b981",
      },
      {
        key: "watching",
        label: "Watching",
        href: "/perso/watching",
        icon: <Tv size={15} />,
        accent: "#8b5cf6",
      },
      {
        key: "books",
        label: "Books",
        href: "/perso/books",
        icon: <BookOpen size={15} />,
        accent: "#f97316",
      },
      {
        key: "travel",
        label: "Travel",
        href: "/perso/travel",
        icon: <Plane size={15} />,
        accent: "#0ea5e9",
      },
      {
        key: "fitness",
        label: "Fitness",
        href: "/perso/fitness",
        icon: <Dumbbell size={15} />,
        accent: "#f43f5e",
      },
    ],
  },
  {
    label: "Pro",
    items: [
      {
        key: "tasks",
        label: "Tasks",
        href: "/pro/tasks",
        icon: <CheckSquare size={15} />,
        accent: "#6366f1",
      },
      {
        key: "goals",
        label: "Goals",
        href: "/pro/goals",
        icon: <Target size={15} />,
        accent: "#22c55e",
      },
      {
        key: "jobhunt",
        label: "Job Hunt",
        href: "/pro/jobhunt",
        icon: <Briefcase size={15} />,
        accent: "#3b82f6",
      },
      {
        key: "tech",
        label: "Tech",
        href: "/pro/tech",
        icon: <Code2 size={15} />,
        accent: "#a855f7",
      },
    ],
  },
];

const W_OPEN = 240;
const W_CLOSED = 60;
const KEY = "sb_c";
const MD = 768;

// ─── helpers ──────────────────────────────────────────────────────────────────

const SECTION_COLORS: Record<string, { from: string; glow: string }> = {
  "/perso/sports": { from: "rgba(16,185,129,0.08)", glow: "#10b981" },
  "/perso/watching": { from: "rgba(139,92,246,0.08)", glow: "#8b5cf6" },
  "/perso/books": { from: "rgba(249,115,22,0.08)", glow: "#f97316" },
  "/perso/travel": { from: "rgba(14,165,233,0.08)", glow: "#0ea5e9" },
  "/perso/fitness": { from: "rgba(244,63,94,0.08)", glow: "#f43f5e" },
  "/pro/tasks": { from: "rgba(99,102,241,0.08)", glow: "#6366f1" },
  "/pro/goals": { from: "rgba(34,197,94,0.08)", glow: "#22c55e" },
  "/pro/jobhunt": { from: "rgba(59,130,246,0.08)", glow: "#3b82f6" },
  "/pro/tech": { from: "rgba(168,85,247,0.08)", glow: "#a855f7" },
};

const getSectionColor = (p: string) => {
  for (const [path, colors] of Object.entries(SECTION_COLORS)) {
    if (p.startsWith(path)) return colors;
  }
  return { from: "rgba(99,102,241,0.04)", glow: "#6366f1" };
};

const readStore = () => {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < MD) return true;
  return localStorage.getItem(KEY) === "1";
};

// ─── tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [y, setY] = useState(0);
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative w-full"
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect();
        if (r) setY(r.top + r.height / 2);
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed z-9999 pointer-events-none"
            style={{
              left: W_CLOSED + 8,
              top: y,
              transform: "translateY(-50%)",
            }}
          >
            <div className="bg-zinc-800/95 backdrop-blur-sm border border-zinc-700/60 text-zinc-100 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon,
  label,
  active,
  accent,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  accent: string;
  collapsed: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-100 cursor-pointer select-none",
        active
          ? "bg-white/[0.07] text-white"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/4",
        collapsed && "justify-center w-9 px-0 mx-auto",
      )}
    >
      <span className="shrink-0" style={active ? { color: accent } : undefined}>
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 text-[13px] font-medium leading-none">
            {label}
          </span>
          {active && (
            <span
              className="w-1 h-3 rounded-full shrink-0"
              style={{ backgroundColor: accent }}
            />
          )}
        </>
      )}
    </div>
  );

  return collapsed ? (
    <Tooltip label={label}>
      <Link href={href} className="block">
        {inner}
      </Link>
    </Tooltip>
  ) : (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}

// ─── profile menu ─────────────────────────────────────────────────────────────

function ProfileMenu({
  open,
  onClose,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 0 });
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    // open above the trigger — anchor to top of trigger
    setPos({ x: r.left, y: r.top, w: r.width });
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
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
          className="fixed z-9999 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: pos.x,
            bottom: `calc(100vh - ${pos.y}px + 8px)`,
            minWidth: Math.max(pos.w, 200),
          }}
        >
          {/* user */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/60">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              Z
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight">
                Zakaria
              </p>
              <p className="text-[11px] text-zinc-500 truncate">
                zakaria@example.com
              </p>
            </div>
          </div>

          {/* items */}
          <div className="p-1.5">
            <Link href="/settings" onClick={onClose}>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lghover:bg-zinc-800 transition-colors cursor-pointer group">
                <Settings
                  size={14}
                  className="text-zinc-500 group-hover:text-zinc-300"
                />
                <span className="text-[13px] text-zinc-400 group-hover:text-zinc-200">
                  Paramètres
                </span>
              </div>
            </Link>

            {/* theme toggle */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer group"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? (
                  <Sun
                    size={14}
                    className="text-zinc-500 group-hover:text-zinc-300"
                  />
                ) : (
                  <Moon
                    size={14}
                    className="text-zinc-500 group-hover:text-zinc-300"
                  />
                )}
                <span className="text-[13px] text-zinc-400 group-hover:text-zinc-200">
                  {theme === "dark" ? "Mode clair" : "Mode sombre"}
                </span>
              </div>
              <div
                className={cn(
                  "w-8 h-4 rounded-full relative transition-colors duration-200",
                  theme === "dark" ? "bg-violet-600" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200",
                    theme === "dark" ? "left-4" : "left-0.5",
                  )}
                />
              </div>
            </div>

            <form action={signOut}>
              <button
                type="submit"
                onClick={onClose}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer group"
              >
                <LogOut
                  size={14}
                  className="text-zinc-500 group-hover:text-red-400"
                />
                <span className="text-[13px] text-zinc-400 group-hover:text-red-400">
                  Déconnexion
                </span>
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readStore);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { from, glow } = getSectionColor(pathname);

  // auto-collapse on resize
  useEffect(() => {
    const fn = () => {
      if (window.innerWidth < MD) setCollapsed(true);
    };
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((p) => {
      const n = !p;
      localStorage.setItem(KEY, n ? "1" : "0");
      return n;
    });
  }, []);

  return (
    <>
      <ProfileMenu
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        anchorRef={profileRef}
      />

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? W_CLOSED : W_OPEN }}
        transition={{ type: "tween", duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col h-screen shrink-0 overflow-hidden border-r border-zinc-800/40"
        style={{ background: "#09090b" }}
      >
        {/* section ambient */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 120% 40% at 50% 0%, ${from.replace("0.08", "0.22")}, transparent 65%)`,
          }}
        />
        {/* bottom glow */}
        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none transition-all duration-700"
          style={{
            background: `linear-gradient(to top, ${from.replace("0.08", "0.10")}, transparent)`,
          }}
        />

        {/* top glow line */}
        <div
          className="absolute top-0 inset-x-0 h-px pointer-events-none transition-all duration-500"
          style={{
            background: `linear-gradient(90deg, transparent, ${glow}90, transparent)`,
          }}
        />

        {/* ── header ── */}
        <div
          className={cn(
            "relative flex items-center h-14 px-3 border-b border-zinc-800/40 shrink-0",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center  text-[10px] font-black text-white shrink-0 transition-colors duration-500"
                style={{
                  background: `linear-gradient(135deg, ${glow}cc, ${glow}66)`,
                }}
              >
                SB
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                className="text-[13px] font-bold text-white whitespace-nowrap tracking-tight"
              >
                Second Brain
              </motion.span>
            </div>
          )}
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/6 transition-colors shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen size={15} />
            ) : (
              <PanelLeftClose size={15} />
            )}
          </button>
        </div>

        {/* ── nav ── */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden py-3 custom-scrollbar-hide">
          {/* dashboard */}
          <div
            className={cn("px-2 mb-2", collapsed && "flex justify-center px-1")}
          >
            <NavItem
              href="/dashboard"
              icon={<LayoutDashboard size={15} />}
              label="Dashboard"
              active={pathname === "/dashboard"}
              accent="#6366f1"
              collapsed={collapsed}
            />
          </div>

          {NAV.map((group) => (
            <div key={group.label} className="mb-1">
              {collapsed ? (
                <div className="h-px bg-zinc-800/50 mx-3 my-2" />
              ) : (
                <p className="px-4 pt-2 pb-1.5 text-[10px] font-semibold uppercase  tracking-widest text-zinc-600 select-none">
                  {group.label}
                </p>
              )}
              <div
                className={cn(
                  "px-2 space-y-0.5",
                  collapsed && "flex flex-col items-center px-1",
                )}
              >
                {group.items.map((item) => (
                  <NavItem
                    key={item.key}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={pathname.startsWith(item.href)}
                    accent={item.accent}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── footer ── */}
        <div className="relative border-t border-zinc-800/40 p-2 shrink-0">
          <div
            ref={profileRef}
            onClick={() => setProfileOpen((p) => !p)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer select-none",
              "hover:bg-white/5 transition-colors duration-150",
              collapsed && "justify-center px-0 w-9 mx-auto",
              profileOpen && "bg-white/5",
            )}
          >
            <div className="w-7 h-7 rounded-full bg-linear-to-br from-violet-500 to-indigo-600  flex items-center justify-center text-xs font-bold text-white shrink-0">
              Z
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-zinc-300 truncate leading-tight">
                    Zakaria
                  </p>
                  <p className="text-[11px] text-zinc-600 truncate">
                    Mon compte
                  </p>
                </div>
                <ChevronUp
                  size={13}
                  className={cn(
                    "text-zinc-600 shrink-0 transition-transform duration-200",
                    !profileOpen && "rotate-180",
                  )}
                />
              </>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
