"use client";

// Add to Following — one modal, two axes (Teams | Competitions), on the shared Dialog primitive
// (dark scrim, no blur). Mirrors the Books add modal's "Add to:" segment. Self-sufficient: reads its
// own follow state via hooks and invalidates on change.
//   · Teams  → search the 287-row reference table (real crests) → follow (user_favorites + sync).
//   · Competitions → the 13 registered, each a Follow/Following toggle.

import { useState } from "react";
import Image from "next/image";
import { Search, X, Plus, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/utils/utils";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useFootballTeams, useTeamSearch, useFollowTeam } from "../../hooks/useFootballTeams";
import {
  useAllCompetitions,
  useFollowedCompetitions,
  useFollowCompetition,
  useUnfollowCompetition,
} from "../../hooks/useFollowedCompetitions";
import { displayCompetitionName } from "../../service";
import type { FootballTeamSearchResult, FollowedCompetition } from "../../service";

const ACCENT = "var(--color-accent-sports)";
const CREST_FALLBACK = "/placeholder-logo.svg";

type Segment = "teams" | "competitions";

export default function FootballAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userId = useCurrentUserId();
  const [segment, setSegment] = useState<Segment>("teams");
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);

  const { data: teams } = useFootballTeams(userId);
  const followedTeamIds = new Set(teams?.allFavoriteTeamIds ?? []);
  const { data: results, isFetching: searching } = useTeamSearch(debounced);
  const followTeam = useFollowTeam(userId);
  const [addingTeamId, setAddingTeamId] = useState<string | null>(null);

  const { data: competitions } = useAllCompetitions();
  const { data: followed } = useFollowedCompetitions(userId);
  const followedCompIds = new Set((followed ?? []).map((c) => c.id));
  const followComp = useFollowCompetition(userId);
  const unfollowComp = useUnfollowCompetition(userId);
  const [togglingCompId, setTogglingCompId] = useState<string | null>(null);

  const handleClose = () => {
    setQuery("");
    setSegment("teams");
    onClose();
  };

  const onFollowTeam = (team: FootballTeamSearchResult) => {
    if (!userId || followedTeamIds.has(team.id) || addingTeamId) return;
    setAddingTeamId(team.id);
    followTeam.mutate(
      { teamId: team.id, apiExternalId: team.api_external_id },
      { onSettled: () => setAddingTeamId(null) },
    );
  };

  const onToggleComp = (comp: FollowedCompetition) => {
    if (!userId || togglingCompId) return;
    setTogglingCompId(comp.id);
    if (followedCompIds.has(comp.id)) {
      unfollowComp.mutate(comp.id, { onSettled: () => setTogglingCompId(null) });
    } else {
      followComp.mutate(
        { competitionId: comp.id, apiExternalId: comp.api_external_id },
        { onSettled: () => setTogglingCompId(null) },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg flex flex-col max-h-[85vh] gap-0 p-0">
        <DialogHeader className="shrink-0 px-5 pb-3 pt-5">
          <DialogTitle className="text-sm font-semibold text-text-primary">Add to Following</DialogTitle>
        </DialogHeader>

        {/* Segment */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex gap-1 rounded-control bg-surface-2 p-1">
            {(["teams", "competitions"] as Segment[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSegment(s)}
                className={cn(
                  "flex-1 rounded-[6px] px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  segment === s ? "bg-surface-3" : "text-text-tertiary hover:text-text-secondary",
                )}
                style={segment === s ? { color: ACCENT } : undefined}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-5">
          {segment === "teams" ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a team…"
                  autoFocus
                  className="bg-surface-2 pl-9 pr-9 focus:border-border-focus"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-secondary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {searching && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
                </div>
              )}

              {!searching && debounced.trim().length >= 2 && results && results.length === 0 && (
                <p className="py-10 text-center text-sm text-text-tertiary">No team found for “{debounced}”</p>
              )}

              {!searching && debounced.trim().length < 2 && (
                <p className="py-10 text-center text-sm text-text-tertiary">Search a team to follow</p>
              )}

              {!searching && results && results.length > 0 && (
                <div className="flex flex-col gap-2">
                  {results.map((team) => {
                    const isFollowed = followedTeamIds.has(team.id);
                    const isAdding = addingTeamId === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        disabled={isFollowed || isAdding}
                        onClick={() => onFollowTeam(team)}
                        className={cn(
                          "flex items-center gap-3 rounded-control border p-3 text-left transition-colors",
                          isFollowed
                            ? "cursor-default border-transparent bg-surface-2/50"
                            : "border-border-subtle bg-surface-2 hover:bg-surface-3",
                        )}
                      >
                        <div className="relative h-9 w-9 shrink-0">
                          <Image src={team.crest_url || CREST_FALLBACK} alt={team.name} fill sizes="36px" className="object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{team.name}</p>
                          <p className="truncate text-xs text-text-tertiary">
                            {[team.tla, team.country].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <StatusIcon following={isFollowed} pending={isAdding} />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {(competitions ?? []).map((comp) => {
                const isFollowed = followedCompIds.has(comp.id);
                const isToggling = togglingCompId === comp.id;
                // Modal shows the COLOR logo (the strip uses white). Same slug in the sibling folder;
                // the 6 without a custom logo fall back to the API emblem (already in colour).
                const logo = comp.logo_url
                  ? comp.logo_url.replace("/leagues-white-logos/", "/leagues-logos/")
                  : comp.emblem_url;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    disabled={isToggling || !userId}
                    onClick={() => onToggleComp(comp)}
                    className="flex items-center gap-3 rounded-control border border-border-subtle bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
                  >
                    <div className="relative h-9 w-9 shrink-0">
                      {logo ? (
                        <Image src={logo} alt={comp.name ?? "Competition"} fill sizes="36px" className="object-contain" />
                      ) : (
                        <div className="h-full w-full rounded-full" style={{ background: comp.brand_color ?? "var(--color-surface-3)" }} />
                      )}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{displayCompetitionName(comp.name)}</p>
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-tertiary" />
                    ) : isFollowed ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: ACCENT }}>
                        <Check className="h-3.5 w-3.5" /> Following
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-text-tertiary">
                        <Plus className="h-3.5 w-3.5" /> Follow
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ following, pending }: { following: boolean; pending: boolean }) {
  if (pending) return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-tertiary" />;
  if (following) return <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />;
  return <Plus className="h-4 w-4 shrink-0 text-text-tertiary" />;
}
