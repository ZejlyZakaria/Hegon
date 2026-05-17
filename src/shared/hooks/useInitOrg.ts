"use client";

import { useEffect } from "react";
import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";

type MembershipRow = {
  org_id: string;
  role: string;
  organizations: { id: string; name: string } | null;
};

type MembershipQueryResult = {
  data: MembershipRow[] | null;
  error: { message: string } | null;
};

export function useInitOrg() {
  const { setOrg, setOrgs } = useOrgStore();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("memberships")
      .select("org_id, role, organizations(id, name)")
      .then(({ data, error }: MembershipQueryResult) => {
        if (error) {
          console.warn("[useInitOrg] memberships query failed:", error.message);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
