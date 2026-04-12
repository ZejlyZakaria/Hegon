import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface OrgState {
  orgId: string | null;
  orgName: string | null;
  setOrg: (orgId: string, orgName: string) => void;
  clearOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  devtools(
    (set) => ({
      orgId: null,
      orgName: null,
      setOrg: (orgId, orgName) => set({ orgId, orgName }),
      clearOrg: () => set({ orgId: null, orgName: null }),
    }),
    { name: "OrgStore" }
  )
);
