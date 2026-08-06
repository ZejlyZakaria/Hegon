"use client";

import { useState } from "react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { useTeamPanel } from "../../hooks/useTeamPanelStore";
import { FootballTeamPanelClient } from "./FootballTeamPanelClient";

// Rendered once at the page root. A card in the Following strip opens it via the store. `display` lags
// the store so the content stays put while the panel slides out on close (no flash of empty panel).
export function FootballTeamPanel() {
  const team = useTeamPanel((s) => s.team);
  const close = useTeamPanel((s) => s.close);

  const [display, setDisplay] = useState(team);
  if (team && team.id !== display?.id) setDisplay(team);

  return (
    <SlidingPanel open={team != null} onClose={close} title={display?.name ?? "Team"}>
      {display && <FootballTeamPanelClient key={display.id} team={display} onUnfollowed={close} />}
    </SlidingPanel>
  );
}
