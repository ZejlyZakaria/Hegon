"use client";

import { motion } from "framer-motion";

const ACCENT_HEX = "#f97316";

export function JournalEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center text-center max-w-xs mx-auto py-16"
    >
      <svg width="64" height="80" viewBox="0 0 64 80" fill="none" className="mb-7">
        {/* Notebook body */}
        <rect x="10" y="6" width="44" height="68" rx="4" fill={ACCENT_HEX} fillOpacity="0.06" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.22" />
        {/* Spine */}
        <rect x="10" y="6" width="8" height="68" rx="3" fill={ACCENT_HEX} fillOpacity="0.14" />
        {/* Text lines */}
        <line x1="24" y1="28" x2="48" y2="28" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
        <line x1="24" y1="40" x2="48" y2="40" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.25" strokeLinecap="round" />
        <line x1="24" y1="52" x2="40" y2="52" stroke={ACCENT_HEX} strokeWidth="1.5" strokeOpacity="0.14" strokeLinecap="round" />
        {/* Cursor dot */}
        <circle cx="43" cy="52" r="2" fill={ACCENT_HEX} fillOpacity="0.5" />
      </svg>

      <h3 className="text-base font-semibold text-text-primary mb-2">
        No entries yet
      </h3>
      <p className="text-sm text-text-tertiary leading-relaxed px-2">
        Your past entries will appear here.
        Start writing from the Today tab.
      </p>
    </motion.div>
  );
}
