"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Plus, Users, Mail, Crown, Shield, Eye } from "lucide-react";
import {
  useOrgInfo,
  useOrgMembers,
  useOrgInvitations,
  useCreateInvitation,
  useRevokeInvitation,
} from "@/modules/orgs/hooks/useOrg";
import { MemberAvatar } from "@/modules/tasks/components/shared/MemberAvatar";
import { formatDistanceToNow, isPast } from "date-fns";
import { cn } from "@/shared/utils/utils";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner:  <Crown  size={12} style={{ color: "#f59e0b" }} />,
  admin:  <Shield size={12} style={{ color: "#60a5fa" }} />,
  member: <Users  size={12} style={{ color: "#a1a1aa" }} />,
  viewer: <Eye    size={12} style={{ color: "#a1a1aa" }} />,
};

export default function SettingsPage() {
  const { data: org } = useOrgInfo();
  const { data: members = [] } = useOrgMembers();
  const { data: invitations = [] } = useOrgInvitations();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();

  const [email, setEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pendingInvitations = invitations.filter(
    (inv) => !inv.used_at && !isPast(new Date(inv.expires_at))
  );

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    const inv = await createInvitation.mutateAsync(email.trim());
    const link = `${window.location.origin}/invite/${inv.token}`;
    setGeneratedLink(link);
    setEmail("");
  }

  function handleCopy() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Settings
        </h1>
        {org && (
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            {org.name}
          </p>
        )}
      </div>

      {/* Members */}
      <section className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-subtle)" }}>

        <div className="flex items-center gap-2">
          <Users size={15} style={{ color: "var(--color-text-tertiary)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Members <span className="ml-1 text-xs font-normal" style={{ color: "var(--color-text-tertiary)" }}>({members.length})</span>
          </h2>
        </div>

        <div className="space-y-1">
          {members.map((member) => (
            <div key={member.user_id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: "var(--color-surface-2)" }}>
              {member.profile && (
                <MemberAvatar member={{ id: member.user_id, email: member.profile.email ?? "", full_name: member.profile.full_name, avatar_url: member.profile.avatar_url }} size="md" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                  {member.profile?.full_name ?? member.profile?.email ?? "Unknown"}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-tertiary)" }}>
                  {member.profile?.email}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {ROLE_ICONS[member.role]}
                <span className="text-xs capitalize" style={{ color: "var(--color-text-tertiary)" }}>
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Invite */}
      <section className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-subtle)" }}>

        <div className="flex items-center gap-2">
          <Mail size={15} style={{ color: "var(--color-text-tertiary)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Invite member
          </h2>
        </div>

        <form onSubmit={handleCreateInvitation} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@email.com"
            className="flex-1 h-9 rounded-lg px-3 text-sm outline-none transition-colors"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={createInvitation.isPending || !email.trim()}
            className="h-9 px-3 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: "#22c55e" }}
          >
            <Plus size={14} />
            Generate link
          </button>
        </form>

        {generatedLink && (
          <div className="rounded-lg p-3 space-y-2"
            style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Share this link — valid for 7 days
            </p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs font-mono truncate" style={{ color: "var(--color-text-secondary)" }}>
                {generatedLink}
              </p>
              <button
                onClick={handleCopy}
                className={cn(
                  "shrink-0 h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                  copied ? "text-green-400" : ""
                )}
                style={{
                  backgroundColor: "var(--color-surface-3)",
                  border: "1px solid var(--color-border-default)",
                  color: copied ? "#4ade80" : "var(--color-text-secondary)",
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>
              Pending ({pendingInvitations.length})
            </p>
            {pendingInvitations.map((inv) => (
              <div key={inv.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ backgroundColor: "var(--color-surface-2)" }}>
                <Mail size={13} style={{ color: "var(--color-text-tertiary)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>{inv.email}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                    Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`);
                  }}
                  className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "var(--color-text-tertiary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; e.currentTarget.style.backgroundColor = "var(--color-surface-3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                  title="Copy invite link"
                >
                  <Copy size={13} />
                </button>
                <button
                  onClick={() => revokeInvitation.mutate(inv.id)}
                  className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: "var(--color-text-tertiary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                  title="Revoke invitation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
