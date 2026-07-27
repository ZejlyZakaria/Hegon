"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Eye,
  Check,
  Clock,
  Play,
  Heart,
  PauseCircle,
  CircleSlash,
  Trash2,
} from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { OVERLAY_CIRCLE } from "./Marks";
import { useWatchActions } from "../../hooks/useWatchActions";
import { seriesState } from "../../lib/series-state";
import DeleteConfirmModal from "../modals/DeleteConfirmModal";
import { CaptureSheet } from "./CaptureSheet";
import { DROP_REASONS } from "../../lib/drop-reasons";
import type { WatchingMedia } from "../../types";

// ── MenuItem ──────────────────────────────────────────────────────────────────

function MenuItem({
  onClick,
  icon,
  children,
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2 transition-colors text-left",
        className,
      )}
    >
      <span className="shrink-0 text-text-tertiary">{icon}</span>
      {children}
    </button>
  );
}

// ── MediaActionMenu ───────────────────────────────────────────────────────────

const MENU_W = 208; // w-52 — the portaled dropdown's width, used to keep it on-screen

interface MediaActionMenuProps {
  item: WatchingMedia;
  triggerClassName?: string;
  onView?: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export function MediaActionMenu({
  item,
  triggerClassName,
  onView,
  onDelete,
}: MediaActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dropSheetOpen, setDropSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // THE SAME ACTIONS AS THE DETAIL PAGE — because they must be the same actions.
  // This menu used to hand-write its own status patches, and it had drifted: it offered
  // "Mark as finished" on a series that is still airing and wrote `watched: true` over a blank
  // position, manufacturing the exact rows a migration had just spent a day repairing. It is on
  // every poster in the app, so it was the widest door of the lot.
  const actions = useWatchActions(item);

  // An action that asserts something ALREADY TRUE is not an action, it's noise. The menu was
  // offering to put your position at the last aired episode on a title whose position is already
  // there — nothing would have happened, and the item was there to tell you so.
  const alreadyCaughtUp = seriesState(item) === "caught-up";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  // Close menu on any scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  // The "…" menu IS shown in the read-only demo — its actions fire the friendly
  // read-only toast (via the guarded hooks), so visitors see how it works.
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Clamp so the (left-growing, w-52 = 208px) menu never spills off-screen — on mobile the
      // first rail item sits near the left edge, and `innerWidth - rect.right` alone pushed the
      // menu's left edge negative, cutting it off. Keep it 8px inside both edges.
      const desiredRight = window.innerWidth - rect.right;
      const maxRight = window.innerWidth - MENU_W - 8;
      setMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, Math.min(desiredRight, maxRight)),
      });
    }
    setOpen((p) => !p);
  };

  const run = (action: () => Promise<unknown>) => { setOpen(false); void action(); };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSeries = item.type === "serie" || item.type === "anime";

  return (
    <>
      {/* The same 24px glass circle as every other overlay action — it used to be a
          `p-1.5` black disc, so it never matched the heart standing next to it. */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={cn(OVERLAY_CIRCLE, "text-white/75 transition-colors hover:text-white", triggerClassName)}
      >
        <MoreVertical size={13} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-200 w-52 bg-surface-3 border border-border-default rounded-card shadow-md overflow-hidden py-1"
            style={{ top: menuPos.top, right: menuPos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            {onView && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                  setOpen(false);
                }}
                icon={<Eye size={13} />}
              >
                View / Edit
              </MenuItem>
            )}

            {/* "Mark as finished" on a show that is still airing was the app's oldest lie, and this
                menu was still telling it on every poster. You cannot finish a story that is still
                being told — what you CAN truthfully say is that you've seen everything that's out,
                so on a running series that is what it offers, and it lands your position on the
                last aired episode instead of writing `watched` over a blank one. */}
            {!item.watched && !alreadyCaughtUp && actions.canMark && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  run(actions.canComplete ? actions.markWatched : actions.markCaughtUp);
                }}
                icon={
                  actions.canComplete
                    ? <Check size={13} className="text-emerald-400" />
                    : <Clock size={13} className="text-emerald-400" />
                }
              >
                {/* NOT "Mark as caught up". You do not MARK a derived state — being caught up falls
                    out of two numbers, and dressing it as a flag to raise is how `watched` became a
                    lie in the first place. What this actually does is claim a POSITION: the last
                    episode that exists. So it says that, as a sentence about you. It is the
                    one-gesture version of "Watched through S3", and it is the only honest thing to
                    offer someone who is genuinely up to date on a show that isn't over. */}
                {actions.canComplete ? "Mark as watched" : "Seen everything that's out"}
              </MenuItem>
            )}

            {isSeries && !item.in_progress && !item.watched && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  run(actions.startWatching);
                }}
                icon={
                  <Play
                    size={13}
                    className="fill-current"
                    style={{ color: "var(--color-accent-watching-vivid)" }}
                  />
                }
              >
                Start watching
              </MenuItem>
            )}

            {isSeries && item.in_progress && !item.watched && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  run(actions.pause);
                }}
                icon={<PauseCircle size={13} className="text-sky-400" />}
              >
                Pause series
              </MenuItem>
            )}

            {isSeries && item.in_progress && !item.watched && !item.dropped && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setDropSheetOpen(true);
                }}
                icon={<CircleSlash size={13} className="text-amber-400" />}
              >
                Drop series
              </MenuItem>
            )}

            {!item.want_to_watch && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  run(actions.toggleFavorite);
                }}
                icon={
                  <Heart
                    size={13}
                    className={item.favorite ? "fill-red-400 text-red-400" : ""}
                  />
                }
              >
                {item.favorite ? "Remove from favorites" : "Add to favorites"}
              </MenuItem>
            )}

            {onDelete && (
              <>
                <div className="my-1 h-px bg-border-default" />
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                    setOpen(false);
                  }}
                  icon={<Trash2 size={13} className="text-red-400" />}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                >
                  Delete permanently
                </MenuItem>
              </>
            )}
          </div>,
          document.body,
        )}

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete "${item.title}"?`}
        description="This will permanently remove it from your collection."
        isDeleting={isDeleting}
      />

      <CaptureSheet
        open={dropSheetOpen}
        onOpenChange={setDropSheetOpen}
        title="Why did you drop it?"
        subtitle="Optional — helps you remember later."
        options={DROP_REASONS}
        onPick={(reason) => actions.drop(reason)}
        onSkip={() => actions.drop(null)}
        skipLabel="Drop without a reason"
      />
    </>
  );
}
