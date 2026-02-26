"use client";

import { JSX, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  Popcorn,
  BookOpen,
  Dumbbell,
  Target,
  Briefcase,
  Heart,
  Cpu,
  Search,
  Settings,
  LayoutGrid,
  ChevronDown,
  ArrowLeftFromLine,
  ArrowRightFromLine,
} from "lucide-react";

import { cn } from "../../lib/utils";
import SidebarMenu from "./SidebarMenu";
import OverflowTooltipWrapper from "../../ui/tootip/OverflowTooltipWrapper";

interface SidebarItem {
  id: string;
  label: string;
  icon: JSX.Element;
  subItems?: { label: string; path: string }[];
}

const sidebarItems: SidebarItem[] = [
  {
    id: "overview",
    label: "Aperçu",
    icon: <LayoutGrid size={15} className="text-white" />,
  },

  // Section Perso
  {
    id: "perso",
    label: "Perso",
    icon: <Heart size={15} className="text-pink-600" />,
    subItems: [
      { label: "Watching", path: "watching" },
      { label: "Books", path: "books" },
      { label: "Sport", path: "sport" },
    ],
  },
  // Sous-menus détaillés pour Watching (expandable)
  {
    id: "watching",
    label: "Watching",
    icon: <Popcorn size={15} className="text-red-500" />,
    subItems: [
      { label: "Films", path: "watching/films" },
      { label: "Séries", path: "watching/series" },
      { label: "Animes", path: "watching/animes" },
      { label: "Watchlist", path: "watching/watchlist" },
    ],
  },
  {
    id: "books",
    label: "Books",
    icon: <BookOpen size={15} className="text-amber-600" />,
    subItems: [
      { label: "À lire", path: "books/a-lire" },
      { label: "Lus", path: "books/lus" },
      { label: "Favoris", path: "books/favoris" },
    ],
  },
  {
    id: "sport",
    label: "Sport",
    icon: <Dumbbell size={15} className="text-green-600" />,
    subItems: [
      { label: "Habitudes", path: "sport/habitudes" },
      { label: "Goals", path: "sport/goals" },
      { label: "Stats", path: "sport/stats" },
    ],
  },

  // Section Pro
  {
    id: "pro",
    label: "Pro",
    icon: <Briefcase size={15} className="text-blue-600" />,
    subItems: [
      { label: "Tech", path: "tech" },
      { label: "Goals", path: "goals" },
      { label: "Job Hunt", path: "job-hunt" },
    ],
  },
  {
    id: "tech",
    label: "Tech",
    icon: <Cpu size={15} className="text-cyan-600" />,
    subItems: [
      { label: "Notes", path: "tech/notes" },
      { label: "Repos", path: "tech/repos" },
      { label: "Upskilling", path: "tech/upskilling" },
    ],
  },
  {
    id: "goals",
    label: "Goals",
    icon: <Target size={15} className="text-purple-600" />,
    subItems: [
      { label: "Court terme", path: "goals/court" },
      { label: "Long terme", path: "goals/long" },
      { label: "Priorités", path: "goals/priorites" },
    ],
  },
  {
    id: "job-hunt",
    label: "Job Hunt",
    icon: <Search size={15} className="text-orange-600" />,
    subItems: [
      { label: "Candidatures", path: "job-hunt/candidatures" },
      { label: "Follow-ups", path: "job-hunt/followups" },
      { label: "Prep interviews", path: "job-hunt/prep" },
    ],
  },

  // Settings en bas
  {
    id: "settings",
    label: "Paramètres",
    icon: <Settings size={15} className="text-white" />,
    subItems: [
      { label: "Thèmes", path: "settings/themes" },
      { label: "Export data", path: "settings/export" },
      { label: "Privacy", path: "settings/privacy" },
    ],
  },
];

const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const closeTimeout = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ✅ Utilise une fonction initializer pour setState
  // Cela s'exécute UNIQUEMENT côté client et évite le mismatch d'hydratation
  const [isExpanded, setIsExpanded] = useState(() => true);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(
    () => ({}),
  );
  const [showFooterText, setShowFooterText] = useState(() => true);
  const [delayedExpand, setDelayedExpand] = useState(() => true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [contextAnchor, setContextAnchor] = useState<HTMLElement | null>(null);

  const toggleSidebar = () => {
    if (isExpanded) {
      setShowFooterText(false);
      setDelayedExpand(false);
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      setTimeout(() => {
        setShowFooterText(true);
        setDelayedExpand(true);
      }, 210);
    }
  };

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className={cn(
        "bg-gray-900 text-xs flex flex-col justify-between transition-all duration-300 ease-in-out text-white",
        isExpanded ? "w-57.5" : "w-12.5",
      )}
    >
      {/* Scrollable menu */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto p-2 custom-scrollbar-hide"
      >
        {sidebarItems.map(({ id, label, icon, subItems }) => {
          const showContext = !isExpanded && hoveredItem === id && !!subItems;

          const isParentActive =
            !subItems &&
            (id === "overview"
              ? pathname === "/"
              : pathname.startsWith(`/${id}`));

          return (
            <div
              key={id}
              className="mb-1"
              onMouseEnter={(e) => {
                if (!isExpanded && subItems) {
                  if (closeTimeout.current) clearTimeout(closeTimeout.current);
                  setHoveredItem(id);
                  setContextAnchor(e.currentTarget);
                }
              }}
              onMouseLeave={() => {
                if (!isExpanded && subItems) {
                  closeTimeout.current = setTimeout(() => {
                    setHoveredItem(null);
                    setContextAnchor(null);
                  }, 200);
                }
              }}
            >
              {subItems ? (
                <div
                  className="flex items-center justify-between cursor-pointer px-2 py-2 rounded hover:bg-gray-400"
                  onClick={() => toggleMenu(id)}
                >
                  <div className="flex items-center gap-3 h-4">
                    {icon}
                    {delayedExpand && (
                      <span
                        className={cn(
                          "font-medium text-white",
                          pathname.startsWith(`/${id}/`) && "text-blue-500",
                        )}
                      >
                        {label}
                      </span>
                    )}
                  </div>

                  {delayedExpand && (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-white transition-transform duration-200",
                        openMenus[id] ? "rotate-180" : "rotate-0",
                      )}
                    />
                  )}
                </div>
              ) : (
                <Link
                  href={id === "overview" ? "/" : `/${id}`}
                  className={cn(
                    "flex items-center justify-between cursor-pointer px-2 py-2 rounded hover:bg-gray-400",
                    isParentActive && "text-blue-500",
                  )}
                >
                  <div className="flex items-center gap-3 h-4">
                    {icon}
                    {delayedExpand && (
                      <span className="text-white font-medium">{label}</span>
                    )}
                  </div>
                </Link>
              )}

              {subItems && (
                <div
                  className={cn(
                    "mt-1 flex flex-col space-y-1 text-white transition-all duration-300 overflow-hidden",
                    openMenus[id] && delayedExpand
                      ? "max-h-50 opacity-100"
                      : "max-h-0 opacity-0",
                  )}
                >
                  {subItems.map(({ label, path }) => {
                    const isSubActive = pathname === `/${id}/${path}`;

                    return (
                      <OverflowTooltipWrapper
                        key={`${id}-${path}`}
                        text={label}
                      >
                        <Link
                          href={`/${id}/${path}`}
                          className={cn(
                            "px-9 group hover:bg-gray-400 hover:text-blue-600 w-full block rounded-sm py-2 truncate",
                            isSubActive && "text-blue-500",
                          )}
                        >
                          {label}
                        </Link>
                      </OverflowTooltipWrapper>
                    );
                  })}
                </div>
              )}

              {showContext && contextAnchor && (
                <SidebarMenu
                  anchorRef={{ current: contextAnchor }}
                  onClose={() => {
                    setHoveredItem(null);
                    setContextAnchor(null);
                  }}
                  items={[
                    { label, onClick: () => {} },
                    ...(subItems ?? []).map((s) => ({
                      label: s.label,
                      onClick: () => router.push(`/${id}/${s.path}`),
                    })),
                  ]}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="p-2 border-t border-gray-800 flex items-center cursor-pointer"
        onClick={toggleSidebar}
      >
        <button className="p-1 rounded hover:bg-gray-400 text-white transition mr-2">
          {isExpanded ? (
            <ArrowLeftFromLine size={16} />
          ) : (
            <ArrowRightFromLine size={16} />
          )}
        </button>

        {isExpanded && showFooterText && (
          <span className="text-white">Masquer la navigation</span>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
