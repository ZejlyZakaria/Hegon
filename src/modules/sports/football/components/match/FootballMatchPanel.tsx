"use client";

import { useState } from "react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { FootballMatchClient } from "./FootballMatchClient";

// Rendered once at the page root. Any match card opens it via the store. `displayId` lags `openId`
// so the content stays put while the panel slides out (no flash of empty panel on close) — updated
// during render, the React-blessed way.
export function FootballMatchPanel() {
  const openId = useMatchPanel((s) => s.openId);
  const close = useMatchPanel((s) => s.close);

  const [displayId, setDisplayId] = useState<number | null>(null);
  if (openId != null && openId !== displayId) setDisplayId(openId);

  return (
    <SlidingPanel open={openId != null} onClose={close} title="Match">
      {displayId != null && <FootballMatchClient externalId={displayId} />}
    </SlidingPanel>
  );
}
