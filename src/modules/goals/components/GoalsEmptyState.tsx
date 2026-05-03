"use client";

import { motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";

const ACCENT_HEX = "#22c55e";

interface Props {
  onCreateClick: () => void;
}

export function GoalsEmptyState({ onCreateClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center text-center max-w-xs mx-auto py-16"
    >
      <svg width="96" height="96" viewBox="0 0 96 96" fill="none" className="mb-7">
        {/* Outer dashed ring */}
        <circle cx="48" cy="48" r="44" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.08" strokeDasharray="3 6" />
        {/* Middle dashed ring */}
        <circle cx="48" cy="48" r="30" stroke={ACCENT_HEX} strokeWidth="1" strokeOpacity="0.16" strokeDasharray="3 5" />
        {/* Inner solid ring */}
        <circle cx="48" cy="48" r="16" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.32" />
        {/* Center dot */}
        <circle cx="48" cy="48" r="4.5" fill={ACCENT_HEX} />
        {/* Milestone dots on orbits */}
        <circle cx="48" cy="4"  r="3.5" fill={ACCENT_HEX} fillOpacity="0.55" />
        <circle cx="88" cy="62" r="3"   fill={ACCENT_HEX} fillOpacity="0.30" />
        <circle cx="13" cy="64" r="2.5" fill={ACCENT_HEX} fillOpacity="0.20" />
        {/* Connector lines */}
        <line x1="48" y1="7.5" x2="48"  y2="32"   stroke={ACCENT_HEX} strokeOpacity="0.12" strokeWidth="1" strokeDasharray="2 3" />
        <line x1="85" y1="62" x2="69"   y2="57"   stroke={ACCENT_HEX} strokeOpacity="0.10" strokeWidth="1" strokeDasharray="2 3" />
        <line x1="16" y1="63" x2="32.5" y2="58.5" stroke={ACCENT_HEX} strokeOpacity="0.08" strokeWidth="1" strokeDasharray="2 3" />
      </svg>

      <h3 className="text-base font-semibold text-text-primary mb-2">
        Define what matters
      </h3>
      <p className="text-sm text-text-tertiary leading-relaxed mb-7 px-2">
        Goals give direction to everything you track in HEGON.
        Each milestone brings you one step closer.
      </p>
      <Button
        type="button"
        onClick={onCreateClick}
        className="h-8 px-4 text-sm font-medium text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-accent-goals)" }}
      >
        + Add New Goal
      </Button>
    </motion.div>
  );
}
