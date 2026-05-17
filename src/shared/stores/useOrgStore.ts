import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface OrgEntry {
  id: string;
  name: string;
  role: string;
}

interface OrgState {
  orgId: string | null;
  orgName: string | null;
  orgs: OrgEntry[];
  setOrg: (orgId: string, orgName: string) => void;
  setOrgs: (orgs: OrgEntry[]) => void;
  clearOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  devtools(
    persist(
      (set) => ({
        orgId: null,
        orgName: null,
        orgs: [],
        setOrg: (orgId, orgName) => set({ orgId, orgName }),
        setOrgs: (orgs) => set({ orgs }),
        clearOrg: () => set({ orgId: null, orgName: null, orgs: [] }),
      }),
      {
        name: "hegon-org",
        partialize: (s) => ({ orgId: s.orgId, orgName: s.orgName }),
      }
    ),
    { name: "OrgStore" }
  )
);
