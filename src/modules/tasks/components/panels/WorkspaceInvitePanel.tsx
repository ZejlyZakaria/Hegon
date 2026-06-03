"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Trash2, Plus, Mail, Crown, Users, Tag as TagIcon } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MemberAvatar } from "../shared/MemberAvatar";
import { useWorkspaceMembers, useWorkspaceInvitations, useCreateWorkspaceInvitation, useRevokeWorkspaceInvitation } from "@/modules/tasks/hooks/useWorkspaceMembers";
import { useTags, useCreateTag, useDeleteTag, useUpdateTag } from "@/modules/tasks/hooks/useTags";
import { useRealtimeTags } from "@/modules/tasks/hooks/useRealtimeTags";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Input } from "@/shared/components/ui/input";
import { WORKSPACE_KEYS } from "@/modules/tasks/hooks/query-keys";
import * as TaskService from "@/modules/tasks/service";
import { cn } from "@/shared/utils/utils";
import { ColorPalette, HEGON_COLORS } from "@/shared/components/ui/color-palette";
import type { Workspace } from "@/modules/tasks/types";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner:  <Crown size={11} style={{ color: "#f59e0b" }} />,
  admin:  <Crown size={11} style={{ color: "#60a5fa" }} />,
  member: <Users size={11} style={{ color: "#a1a1aa" }} />,
  viewer: <Users size={11} style={{ color: "#a1a1aa" }} />,
};

interface Props {
  workspace: Workspace;
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tab = "members" | "tags";

export function WorkspaceInvitePanel({ workspace, currentUserId, open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(HEGON_COLORS[3]);

  const queryClient = useQueryClient();
  const { data: members = [] } = useWorkspaceMembers(open ? workspace.id : null);
  const { data: invitations = [] } = useWorkspaceInvitations(open ? workspace.id : null);
  const { data: tags = [] } = useTags(open ? workspace.id : null);
  const createInvitation = useCreateWorkspaceInvitation(workspace.id);
  const revokeInvitation = useRevokeWorkspaceInvitation(workspace.id);
  const createTag = useCreateTag(workspace.id);
  const deleteTag = useDeleteTag(workspace.id);
  const updateTag = useUpdateTag(workspace.id);

  useRealtimeTags(open ? workspace.id : null);

  const isOwnerSelf = workspace.user_id === currentUserId;
  const { data: ownerProfile } = useQuery({
    queryKey: ["profile", workspace.user_id],
    queryFn: () => TaskService.getProfileById(workspace.user_id),
    enabled: open && !isOwnerSelf,
    staleTime: 1000 * 60 * 5,
  });

  useRealtimeSync({
    channelName: `workspace-members-panel-${workspace.id}`,
    table: "workspace_members",
    filter: `workspace_id=eq.${workspace.id}`,
    enabled: open,
    onchange: () => { queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.members(workspace.id) }); },
  });

  useRealtimeSync({
    channelName: `workspace-invitations-panel-${workspace.id}`,
    table: "org_invitations",
    filter: `workspace_id=eq.${workspace.id}`,
    enabled: open,
    onchange: () => { queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.invitations(workspace.id) }); },
  });

  const pendingInvitations = invitations.filter(
    (inv) => !inv.used_at && !isPast(new Date(inv.expires_at))
  );

  const isOwner = isOwnerSelf;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError(null);
    const inv = await createInvitation.mutateAsync(trimmed);
    setGeneratedLink(`${window.location.origin}/invite/${inv.token}`);
    setEmail("");
  }

  function handleCopy(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    await createTag.mutateAsync({ name: trimmed, color: newTagColor });
    setNewTagName("");
    setNewTagColor(HEGON_COLORS[3]);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-120 flex-col border-l shadow-lg"
            style={{
              backgroundColor: "var(--color-surface-0)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            {/* Header */}
            <div
              className="flex h-14 shrink-0 items-center justify-between border-b px-5"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {workspace.name}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  Workspace settings
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab bar */}
            <div
              className="flex shrink-0 border-b px-5"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              {(["members", "tags"] as const).map((tab) => {
                const active = activeTab === tab;
                const count = tab === "members" ? members.length + 1 : tags.length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-3 text-xs font-medium transition-colors",
                      active ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
                    )}
                  >
                    {tab === "members" ? <Users size={13} /> : <TagIcon size={13} />}
                    <span className="capitalize">{tab}</span>
                    <span
                      className="rounded-full px-1.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: active ? "var(--color-surface-3)" : "var(--color-surface-2)",
                        color: active ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                      }}
                    >
                      {count}
                    </span>
                    {active && (
                      <span
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                        style={{ backgroundColor: "var(--color-text-primary)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === "members" && (
              <>
              {/* Members */}
              <div className="p-5 space-y-3">
                <p className="text-caption uppercase text-text-tertiary">
                  Members ({members.length + 1})
                </p>

                {/* Owner row */}
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: "var(--color-surface-1)" }}
                >
                  {isOwnerSelf ? (
                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      Me
                    </div>
                  ) : (
                    <MemberAvatar
                      member={{
                        id: workspace.user_id,
                        email: ownerProfile?.email ?? "",
                        full_name: ownerProfile?.full_name ?? null,
                        avatar_url: ownerProfile?.avatar_url ?? null,
                      }}
                      size="md"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {isOwnerSelf
                        ? "You"
                        : (ownerProfile?.full_name ?? ownerProfile?.email ?? "Owner")}
                    </p>
                    {!isOwnerSelf && ownerProfile?.email && (
                      <p className="text-xs truncate" style={{ color: "var(--color-text-tertiary)" }}>
                        {ownerProfile.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {ROLE_ICONS["owner"]}
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>owner</span>
                  </div>
                </div>

                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: "var(--color-surface-1)" }}
                  >
                    {member.profile && (
                      <MemberAvatar
                        member={{ id: member.user_id, email: member.profile.email ?? "", full_name: member.profile.full_name, avatar_url: member.profile.avatar_url }}
                        size="md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                        {member.profile?.full_name ?? member.profile?.email ?? "Member"}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--color-text-tertiary)" }}>
                        {member.profile?.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ROLE_ICONS[member.role] ?? ROLE_ICONS.member}
                      <span className="text-xs capitalize" style={{ color: "var(--color-text-tertiary)" }}>
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite — only for workspace owner */}
              {isOwner && (
                <div
                  className="mx-5 mb-5 rounded-xl border p-4 space-y-3"
                  style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-subtle)" }}
                >
                  <p className="text-caption uppercase text-text-tertiary">
                    Invite someone
                  </p>

                  <form onSubmit={handleInvite} className="flex gap-2">
                    <Input
                      variant="tasks"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                      placeholder="colleague@email.com"
                      aria-invalid={!!emailError}
                      className="h-8 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={createInvitation.isPending || !email.trim()}
                      className="h-8 px-3 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 bg-zinc-600 hover:bg-zinc-500 transition-colors disabled:opacity-50"
                    >
                      <Plus size={13} />
                      Invite
                    </button>
                  </form>
                  {emailError && (
                    <p className="text-xs" style={{ color: "#ef4444" }}>{emailError}</p>
                  )}

                  {generatedLink && (
                    <div
                      className="rounded-lg p-3 space-y-2"
                      style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        Share this link — valid 7 days
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-xs font-mono truncate" style={{ color: "var(--color-text-secondary)" }}>
                          {generatedLink}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedLink)}
                          className={cn("shrink-0 h-7 px-2 rounded-md text-xs flex items-center gap-1 transition-colors")}
                          style={{
                            backgroundColor: "var(--color-surface-3)",
                            border: "1px solid var(--color-border-default)",
                            color: copied ? "#4ade80" : "var(--color-text-secondary)",
                          }}
                        >
                          {copied ? <Check size={11} /> : <Copy size={11} />}
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {pendingInvitations.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                        Pending ({pendingInvitations.length})
                      </p>
                      {pendingInvitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{ backgroundColor: "var(--color-surface-2)" }}
                        >
                          <Mail size={12} style={{ color: "var(--color-text-tertiary)" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
                              {inv.email}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                              Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(`${window.location.origin}/invite/${inv.token}`)}
                            className="h-6 w-6 rounded flex items-center justify-center shrink-0 text-text-tertiary transition-colors hover:text-text-primary hover:bg-surface-3"
                            title="Copy link"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeInvitation.mutate(inv.id)}
                            className="h-6 w-6 rounded flex items-center justify-center shrink-0 text-text-tertiary transition-colors hover:text-red-400 hover:bg-red-500/10"
                            title="Revoke"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </>
              )}

              {activeTab === "tags" && (
              <div className="p-5 space-y-4">
                {/* New tag input on top */}
                <div
                  className="rounded-xl border p-4 space-y-2"
                  style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-subtle)" }}
                >
                  <p className="text-caption uppercase text-text-tertiary">
                    New tag
                  </p>

                  <ColorPalette selected={newTagColor} onChange={setNewTagColor} />

                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 flex-1 rounded-lg px-2.5 bg-zinc-800/50 border border-zinc-700/50">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: newTagColor }}
                      />
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreateTag(); } }}
                        placeholder="Tag name..."
                        className="flex-1 h-8 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateTag()}
                      disabled={!newTagName.trim() || createTag.isPending}
                      className="h-8 px-3 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 bg-zinc-600 hover:bg-zinc-500 transition-colors disabled:opacity-50"
                    >
                      <Plus size={13} />
                      Add
                    </button>
                  </div>
                </div>

                {/* Tags list below */}
                {tags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-caption uppercase text-text-tertiary">
                      Existing tags ({tags.length})
                    </p>
                    <div className="space-y-1.5">
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                          style={{ backgroundColor: "var(--color-surface-1)", border: "1px solid var(--color-border-subtle)" }}
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-3 h-3 rounded-full shrink-0 hover:ring-2 hover:ring-white/30 transition-shadow"
                                style={{ backgroundColor: tag.color ?? "#71717a" }}
                                title="Change color"
                              />
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-auto p-3 bg-surface-3 border-border-strong"
                            >
                              <ColorPalette
                                selected={tag.color ?? "#6b7280"}
                                onChange={(color) => updateTag.mutate({ tagId: tag.id, updates: { color } })}
                              />
                            </PopoverContent>
                          </Popover>
                          <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
                            {tag.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteTag.mutate(tag.id)}
                            disabled={deleteTag.isPending}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded flex items-center justify-center text-text-tertiary transition-colors hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            title="Delete tag"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
