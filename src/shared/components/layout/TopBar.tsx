"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, Sun, Moon, LogOut, Settings, Check, Building2 } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { useTheme } from "next-themes";
import { signOut } from "@/infrastructure/auth/actions";
import { useCommandCenter } from "@/modules/command-center/store";
import { cn } from "@/shared/utils/utils";
import { useOrgStore } from "@/shared/stores/useOrgStore";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";

// ─── breadcrumb ───────────────────────────────────────────────────────────────

const SECTION_BREADCRUMBS: Array<[string, string[]]> = [
  ["/settings",               ["Settings"]],
  ["/dashboard",              ["Dashboard"]],
  ["/life/goals",             ["Life", "Goals"]],
  ["/life/habits",            ["Life", "Habits"]],
  ["/life/journal",           ["Life", "Journal"]],
  ["/life/books",             ["Life", "Books"]],
  ["/perso/sports/football",  ["Sport", "Football"]],
  ["/perso/sports/tennis",    ["Sport", "Tennis"]],
  ["/perso/sports/f1",        ["Sport", "F1"]],
  ["/perso/watching/movies",   ["Watching", "Movies"]],
  ["/perso/watching/tv-shows", ["Watching", "TV Shows"]],
  ["/perso/watching/animes",   ["Watching", "Animes"]],
  ["/perso/watching/library",  ["Watching", "Library"]],
  ["/perso/watching/lists",    ["Watching", "Lists"]],
  ["/perso/watching/stats",    ["Watching", "Stats"]],
  ["/pro/tasks",              ["Pro", "Tasks"]],
  ["/pro/jobhunt",            ["Pro", "Job Hunt"]],
  ["/pro/tech",               ["Pro", "Tech"]],
];

function getBreadcrumb(pathname: string): string[] | null {
  for (const [prefix, crumbs] of SECTION_BREADCRUMBS) {
    if (pathname.startsWith(prefix)) return crumbs;
  }
  return null;
}

function Breadcrumb({ crumbs }: { crumbs: string[] | null }) {
  if (!crumbs || crumbs.length === 0) return <div />;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text-tertiary text-xs">/</span>}
          <span
            className={
              i === crumbs.length - 1
                ? "text-text-primary font-medium"
                : "text-text-tertiary"
            }
          >
            {crumb}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── profile menu ─────────────────────────────────────────────────────────────

function ProfileMenu({
  open,
  onClose,
  anchorRef,
  userEmail,
  avatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  userEmail: string | null;
  avatarUrl: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { orgId, orgs, setOrg } = useOrgStore();

  const handleSwitchOrg = (id: string, name: string) => {
    setOrg(id, name);
    router.refresh();
    onClose();
  };

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
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
          className="fixed z-20 bg-surface-3 backdrop-blur-xl border border-border-strong rounded-xl shadow-2xl overflow-hidden"
          style={{ top: pos.top, right: pos.right, minWidth: 200 }}
        >
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle">
            <div className={cn(
              "w-8 h-8 rounded-full overflow-hidden shrink-0",
              !avatarUrl && "bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white"
            )}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-full h-full object-cover"
                />
              ) : "Z"}
            </div>
            <p className="text-[11px] text-text-tertiary truncate">
              {userEmail ?? "—"}
            </p>
          </div>

          {orgs.length > 1 && (
            <div className="border-b border-border-subtle px-2 py-1.5">
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                Workspaces
              </p>
              {orgs.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id, org.name)}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-text-tertiary shrink-0" />
                    <span className="text-[13px] text-text-secondary truncate max-w-32.5">{org.name}</span>
                  </div>
                  {orgId === org.id && <Check size={12} className="text-violet-400 shrink-0" />}
                </div>
              ))}
            </div>
          )}

          <div className="p-1.5">
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer group"
              onClick={() => { router.push("/settings"); onClose(); }}
            >
              <Settings size={14} className="text-text-tertiary group-hover:text-text-secondary" />
              <span className="text-[13px] text-text-secondary group-hover:text-text-primary">Settings</span>
            </div>

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
              <div
                className={cn(
                  "w-8 h-4 rounded-full relative transition-colors duration-200",
                  theme === "dark" ? "bg-violet-600" : "bg-surface-3",
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
                <LogOut size={14} className="text-text-tertiary group-hover:text-red-400" />
                <span className="text-[13px] text-text-secondary group-hover:text-red-400">
                  Sign out
                </span>
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── topbar ───────────────────────────────────────────────────────────────────

export default function TopBar() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const openCmdK = useCommandCenter((s) => s.open);

  useEffect(() => {
    // getSession() reads from localStorage (0ms), getUser() makes a network round
    // trip (~150ms) → flash de avatar/name à chaque mount. Audit §2.6.
    createClient()
      .auth.getSession()
      .then(({ data: { session } }: { data: { session: { user: { user_metadata?: { full_name?: string; name?: string; avatar_url?: string }; email?: string } } | null } }) => {
        const user = session?.user;
        if (!user) return;
        const name =
          user.user_metadata?.full_name?.split(" ")[0] ??
          user.user_metadata?.name?.split(" ")[0] ??
          user.email?.split("@")[0] ??
          "there";
        setUserName(name);
        setUserEmail(user.email ?? null);
        setAvatarUrl(user.user_metadata?.avatar_url ?? null);
      });
  }, []);

  const initial = userName?.[0]?.toUpperCase() ?? "Z";
  const watchingPageLabel = useWatchingUIStore((s) => s.pageLabel);
  const crumbs = watchingPageLabel
    ? ["Watching", watchingPageLabel.section, watchingPageLabel.title]
    : getBreadcrumb(pathname);

  return (
    <>
      <ProfileMenu
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        anchorRef={avatarRef}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
      />

      <header className="shrink-0 bg-[#09090b]">
        <div className="max-w-400 mx-auto px-6 h-14 flex items-center justify-between w-full">
          <Breadcrumb crumbs={crumbs} />

          {/* Right: ⌘K + notifications + avatar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCmdK}
              className="flex items-center gap-2 px-3 h-8 rounded-lg bg-surface-1 border border-border-subtle text-text-tertiary text-xs hover:bg-surface-2 hover:text-text-secondary transition-colors"
            >
              <Search size={13} />
              <span>Search...</span>
              <kbd className="ml-1 text-[10px] bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle font-sans leading-none">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-surface-1 transition-colors"
            >
              <Bell size={15} />
            </button>

            <div
              ref={avatarRef}
              onClick={() => setProfileOpen((p) => !p)}
              className={cn(
                "w-8 h-8 rounded-full overflow-hidden cursor-pointer transition-all duration-150",
                !avatarUrl && "bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white",
                profileOpen ? "ring-2 ring-white/25" : "hover:ring-2 hover:ring-white/15",
              )}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={userName ?? "avatar"}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-full h-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
