"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/infrastructure/supabase/client";
import * as OrgService from "@/modules/orgs/service";
import type { OrgInvitation } from "@/modules/orgs/types";
import { useOrgStore } from "@/shared/stores/useOrgStore";
import { Loader2, CheckCircle, XCircle, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type PageState = "loading" | "valid" | "invalid" | "expired" | "used" | "already_member" | "accepted" | "network_error";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<PageState>("loading");
  const [invitation, setInvitation] = useState<OrgInvitation | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setState("loading");
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      try {
        const inv = await OrgService.getInvitationByToken(token);
        if (!inv) { setState("invalid"); return; }

        if (inv.used_at) { setState("used"); return; }
        if (new Date(inv.expires_at) < new Date()) { setState("expired"); return; }

        setInvitation(inv);
        setState("valid");
      } catch (err) {
        // Distinguish network failure (retry makes sense) from actual invalid token (§1.6)
        const msg = err instanceof Error ? err.message : "";
        const isNetwork = err instanceof TypeError || msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network");
        setState(isNetwork ? "network_error" : "invalid");
      }
    }
    load();
  }, [token, retryKey]);

  async function handleAccept() {
    setIsAccepting(true);
    try {
      const result = await OrgService.acceptInvitation(token);
      // Switch active org to the joined one immediately — bypass getCurrentOrgId
      // race where a multi-org user could land in their personal (empty) org first.
      const joinedOrgName = (invitation?.org as { name: string } | undefined)?.name ?? "Workspace";
      useOrgStore.getState().setOrg(result.org_id, joinedOrgName);
      // Garde-fou 4: set workspace cookie so middleware skips workspace query on first nav
      document.cookie = `hegon_has_workspace=1; max-age=${7 * 24 * 60 * 60}; path=/; samesite=lax`;
      setState("accepted");
      // refresh() avant push() pour que le middleware/RSC voient
      // la nouvelle ligne workspace_members et que /pro/tasks rende
      // le sidebar complet sans flash vide.
      router.refresh();
      setTimeout(() => router.push("/pro/tasks"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Already a member")) setState("already_member");
      else setState("invalid");
    } finally {
      setIsAccepting(false);
    }
  }

  const orgName = (invitation?.org as { name: string } | undefined)?.name ?? "this organization";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-surface-0, #09090b)" }}>

      <div className="mb-8">
        <Image src="/logo/Hegon_white_logo.png" alt="HEGON" width={44} height={44} />
      </div>

      <div className="w-full max-w-md rounded-2xl border p-8 space-y-6"
        style={{
          backgroundColor: "var(--color-surface-1, #111113)",
          borderColor: "var(--color-border-subtle, rgba(255,255,255,0.08))",
        }}>

        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>Loading invitation...</p>
          </div>
        )}

        {state === "valid" && invitation && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--color-surface-2)" }}>
                <Users size={22} style={{ color: "var(--color-text-secondary)" }} />
              </div>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  You&apos;ve been invited
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Join <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{orgName}</span> on HEGON
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 text-xs space-y-1"
              style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-tertiary)" }}>
              <p>Role: <span style={{ color: "var(--color-text-secondary)" }} className="capitalize">{invitation.role}</span></p>
              <p>Expires: <span style={{ color: "var(--color-text-secondary)" }}>{formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}</span></p>
            </div>

            {isLoggedIn ? (
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full h-10 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#22c55e" }}
              >
                {isAccepting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Joining...
                  </span>
                ) : (
                  `Join ${orgName}`
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-center" style={{ color: "var(--color-text-tertiary)" }}>
                  You need an account to accept this invitation
                </p>
                <button
                  onClick={() => router.push(`/auth?next=/invite/${token}`)}
                  className="w-full h-10 rounded-lg text-sm font-medium text-white transition-opacity"
                  style={{ backgroundColor: "#22c55e" }}
                >
                  Login or create account
                </button>
              </div>
            )}
          </>
        )}

        {state === "network_error" && (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <XCircle size={36} style={{ color: "#f59e0b" }} />
            <div>
              <h1 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Connection error
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                Couldn&apos;t reach the server. Check your connection and try again.
              </p>
            </div>
            <button
              onClick={() => setRetryKey(k => k + 1)}
              className="mt-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: "#f59e0b" }}
            >
              Retry
            </button>
          </div>
        )}

        {(state === "invalid" || state === "expired" || state === "used") && (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <XCircle size={36} style={{ color: "#ef4444" }} />
            <div>
              <h1 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {state === "expired" ? "Invitation expired" : state === "used" ? "Invitation already used" : "Invalid invitation"}
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                Ask the workspace owner to send a new link.
              </p>
            </div>
          </div>
        )}

        {state === "already_member" && (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <CheckCircle size={36} style={{ color: "#22c55e" }} />
            <div>
              <h1 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Already a member
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                You&apos;re already part of this organization.
              </p>
            </div>
            <button
              onClick={() => router.push("/pro/tasks")}
              className="mt-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: "#22c55e" }}
            >
              Go to Tasks
            </button>
          </div>
        )}

        {state === "accepted" && (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <CheckCircle size={36} style={{ color: "#22c55e" }} />
            <div>
              <h1 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Welcome to {orgName}!
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                Redirecting you to Tasks...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
