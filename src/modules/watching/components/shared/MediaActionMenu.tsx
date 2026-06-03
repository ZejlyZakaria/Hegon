"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Eye,
  Check,
  Play,
  Heart,
  Trash2,
} from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useUpdateMedia } from "../../hooks/useUpdateMedia";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import DeleteConfirmModal from "../modals/DeleteConfirmModal";
import type { WatchingMedia } from "../../types";
import { toast } from "@/shared/utils/toast";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateMedia = useUpdateMedia();
  const isDemo = useIsDemo();

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

  // Read-only demo: no write affordances (card click still opens the detail).
  if (isDemo) return null;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((p) => !p);
  };

  const run = async (action: () => Promise<void>) => {
    setOpen(false);
    try {
      await action();
    } catch {
      toast.error("Failed to update.");
    }
  };

  const handleMarkWatched = () =>
    run(async () => {
      await updateMedia.mutateAsync({
        id: item.id,
        watched: true,
        recently_watched: true,
        in_progress: false,
        want_to_watch: false,
        is_reference: false,
        watched_at: new Date().toISOString(),
      });
      toast("Marked as watched.");
    });

  const handleStartWatching = () =>
    run(async () => {
      await updateMedia.mutateAsync({
        id: item.id,
        in_progress: true,
        watched: false,
        want_to_watch: false,
        is_reference: false,
      });
      toast("Started watching.");
    });

  const handleFavoriteToggle = () =>
    run(async () => {
      await updateMedia.mutateAsync({ id: item.id, favorite: !item.favorite });
      toast(item.favorite ? "Removed from favorites." : "Added to favorites.");
    });

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
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          "p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-colors",
          triggerClassName,
        )}
      >
        <MoreVertical size={14} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-200 w-52 bg-surface-3 border border-border-default rounded-xl shadow-md overflow-hidden py-1"
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

            {!item.watched && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkWatched();
                }}
                icon={<Check size={13} className="text-emerald-400" />}
              >
                {item.in_progress ? "Mark as finished" : "Mark as watched"}
              </MenuItem>
            )}

            {isSeries && !item.in_progress && !item.watched && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartWatching();
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

            {!item.want_to_watch && (
              <MenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleFavoriteToggle();
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
    </>
  );
}
