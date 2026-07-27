"use client";

import { useEffect } from "react";
import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";
import { toast } from "@/shared/utils/toast";

type MembershipRow = {
  org_id: string;
  role: string;
  organizations: { id: string; name: string } | null;
};

type MembershipQueryResult = {
  data: MembershipRow[] | null;
  error: { message: string } | null;
};

// Supabase's auth client guards token refresh with a Navigator LockManager lock. During a burst of
// navigation, a concurrent request can acquire it with the `steal` option, ABORTING whichever call
// was holding it — surfacing here as "Lock broken by another request with the 'steal' option." It is
// transient and benign (the very next attempt succeeds), so it must NOT raise the "please refresh"
// alarm: we retry once, quietly, and only a real failure reaches the user.
const isTransientLock = (message: string) =>
  message.includes("Lock") || message.includes("AbortError") || message.includes("steal");

export function useInitOrg() {
  const { setOrg, setOrgs } = useOrgStore();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = (attempt = 0) => {
      supabase
        .from("memberships")
        .select("org_id, role, organizations(id, name)")
        .then(({ data, error }: MembershipQueryResult) => {
          if (cancelled) return;

          if (error) {
            // Transient lock steal → try once more before bothering anyone. Still failing after the
            // retry is left silent (a warn, no toast): it clears itself on the next load, and the
            // alarm was the actual bug here, not the abort.
            if (isTransientLock(error.message)) {
              if (attempt < 1) {
                setTimeout(() => { if (!cancelled) load(attempt + 1); }, 300);
              } else {
                console.warn("[useInitOrg] memberships query aborted by an auth-lock steal (transient).");
              }
              return;
            }
            console.error("[useInitOrg] memberships query failed:", error.message);
            toast.error("Couldn't load your workspace. Please refresh.");
            return;
          }

          if (!data || data.length === 0) return;

          const orgs = data.map((m: MembershipRow) => {
            const org = m.organizations as unknown as { id: string; name: string } | null;
            return { id: m.org_id, name: org?.name ?? "Workspace", role: m.role };
          });

          setOrgs(orgs);

          // Keep persisted org if still valid, otherwise pick first
          const current = useOrgStore.getState().orgId;
          const isValid = orgs.some((o: { id: string }) => o.id === current);
          if (!isValid) {
            setOrg(orgs[0].id, orgs[0].name);
          }
        });
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
