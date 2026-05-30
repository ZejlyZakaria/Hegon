"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WrappedCard } from "./WrappedCard";
import type { StatsRawItem } from "../../service";

interface WrappedModalProps {
  year: number;
  films: number;
  seriesAnime: number;
  hours: number;
  topGenre: string | null;
  topPosters: StatsRawItem[];
  total: number;
  onClose: () => void;
}

const CARD_H = 780;
const ACTIONS_H = 68;
const V_PADDING = 32;

export function WrappedModal(props: WrappedModalProps) {
  const { onClose, year } = props;
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const compute = () => {
      const available = window.innerHeight - V_PADDING;
      const needed = CARD_H + ACTIONS_H;
      setScale(Math.min(1, available / needed));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const el = document.getElementById("wrapped-card");
      if (!el) return;

      // Wait for all images to be fully loaded before capturing
      const images = Array.from(el.querySelectorAll("img"));
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }),
        ),
      );

      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 3 });

      const link = document.createElement("a");
      link.download = `hegon-wrap-${year}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Card */}
        <div style={{ overflow: "hidden", borderRadius: 28, boxShadow: "0 40px 80px rgba(0,0,0,0.8)" }}>
          <WrappedCard {...props} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              background: "#fff",
              border: "none",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#000",
              cursor: downloading ? "not-allowed" : "pointer",
              opacity: downloading ? 0.5 : 1,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloading ? "Generating…" : "Download PNG"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
