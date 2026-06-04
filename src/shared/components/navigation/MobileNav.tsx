"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { NAV_GROUPS } from "./Dock";
import { useUserSettings, useIsDemo } from "@/modules/settings/hooks/useSettings";

// Mobile navigation: a hamburger in the TopBar that opens a slide-in drawer.
// Replaces the 56px Dock rail on small screens. Hidden for the demo (it's
// locked to a single module and navigates via the section tabs).
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: settings } = useUserSettings();
  const isDemo = useIsDemo();
  const hidden = new Set(settings?.hidden_modules ?? []);

  if (isDemo) return null;

  const close = () => setOpen(false);
  const isActive = (href: string, prefix?: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(prefix ?? href);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-1 hover:text-text-secondary"
      >
        <Menu size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              onClick={close}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col overflow-hidden border-r border-white/5 lg:hidden"
              style={{ background: "#0e0e10" }}
            >
              {/* ambient glow */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40"
                style={{ background: "radial-gradient(ellipse 120% 60% at 50% 0%, rgba(139,92,246,0.18), transparent 70%)" }}
              />

              {/* header */}
              <div className="relative flex h-14 shrink-0 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 overflow-hidden rounded-lg">
                    <Image src="/logo/Hegon_black_logo2.png" alt="HEGON" fill sizes="28px" className="object-contain" />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-white">HEGON</span>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-white/5 hover:text-text-primary"
                >
                  <X size={16} />
                </button>
              </div>

              {/* nav */}
              <nav className="relative flex-1 overflow-y-auto px-2 py-3 custom-scrollbar-hide">
                <DrawerItem
                  href="/dashboard"
                  label="Dashboard"
                  accent="#60a5fa"
                  icon={<LayoutDashboard size={17} />}
                  active={isActive("/dashboard")}
                  onClick={close}
                />

                {NAV_GROUPS.map((group, gi) => {
                  const items = group.filter((item) => !hidden.has(item.key));
                  if (items.length === 0) return null;
                  return (
                    <div key={gi} className="mt-1 space-y-0.5 border-t border-white/5 pt-2">
                      {items.map((item) => (
                        <DrawerItem
                          key={item.key}
                          href={item.href}
                          label={item.label}
                          accent={item.accent}
                          icon={item.icon}
                          active={isActive(item.href, item.activePrefix)}
                          comingSoon={item.comingSoon}
                          onClick={close}
                        />
                      ))}
                    </div>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function DrawerItem({
  href, label, icon, accent, active, comingSoon, onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
  active: boolean;
  comingSoon?: boolean;
  onClick: () => void;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
        comingSoon
          ? "cursor-default text-zinc-700"
          : active
            ? "bg-white/[0.07] text-white"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      <span className="shrink-0" style={active && !comingSoon ? { color: accent } : undefined}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {comingSoon && (
        <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
          Soon
        </span>
      )}
      {active && !comingSoon && (
        <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
      )}
    </div>
  );

  if (comingSoon) return <div>{inner}</div>;
  return (
    <Link href={href} onClick={onClick} className="block">
      {inner}
    </Link>
  );
}
