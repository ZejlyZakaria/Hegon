"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useTeamPanel } from "../../hooks/useTeamPanelStore";
import { useUnfollowTeam } from "../../hooks/useFootballTeams";
import { FootballTeamPanelClient } from "./FootballTeamPanelClient";

// Rendered once at the page root. A card in the Following strip opens it via the store. `display` lags
// the store so the content stays put while the panel slides out on close (no flash of empty panel).
// Unfollow lives in the header ("..." menu) so it's always reachable, never below a long scroll.
export function FootballTeamPanel() {
  const team = useTeamPanel((s) => s.team);
  const close = useTeamPanel((s) => s.close);
  const userId = useCurrentUserId();
  const unfollow = useUnfollowTeam(userId);

  const [display, setDisplay] = useState(team);
  if (team && team.id !== display?.id) setDisplay(team);

  const [menuOpen, setMenuOpen] = useState(false);

  const handleClose = () => {
    setMenuOpen(false);
    close();
  };

  const handleUnfollow = () => {
    if (!display) return;
    setMenuOpen(false);
    unfollow.mutate(display.id, { onSuccess: handleClose });
  };

  const headerAction = display ? (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
        aria-label="Team options"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-control border border-border-strong bg-surface-2 py-1 shadow-xl shadow-black/40">
            <button
              type="button"
              onClick={handleUnfollow}
              disabled={unfollow.isPending}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              {unfollow.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Unfollow this team
            </button>
          </div>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <SlidingPanel open={team != null} onClose={handleClose} title={display?.name ?? "Team"} headerAction={headerAction}>
      {display && <FootballTeamPanelClient key={display.id} team={display} />}
    </SlidingPanel>
  );
}
