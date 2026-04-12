"use client";

import { useEffect } from "react";
import { createClient } from "@/infrastructure/supabase/client";
import { useOrgStore } from "@/shared/stores/useOrgStore";

/**
 * Initialise le store Zustand avec l'org de l'utilisateur connecté.
 * À appeler une seule fois haut dans l'arbre (ex: Sidebar).
 */
export function useInitOrg() {
  const { orgId, setOrg } = useOrgStore();

  useEffect(() => {
    if (orgId) return; // déjà chargé

    const supabase = createClient();
    supabase
      .from("memberships")
      .select("org_id, organizations(name)")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          const org = data.organizations as unknown as { name: string } | null;
          setOrg(data.org_id, org?.name ?? "My Workspace");
        }
      });
  }, [orgId, setOrg]);
}
