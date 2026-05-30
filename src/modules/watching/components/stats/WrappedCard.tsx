/* eslint-disable @next/next/no-img-element */
"use client";

import type { StatsRawItem } from "../../service";
import { displayTitle } from "../../utils";

// Route images through a same-origin proxy → no CORS issues for html2canvas
function proxyUrl(url: string | null): string | null {
  if (!url) return null;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface WrappedCardProps {
  year: number;
  films: number;
  seriesAnime: number;
  hours: number;
  topGenre: string | null;
  topPosters: StatsRawItem[];
  total: number;
}

// All inline styles — no Tailwind classes — so html2canvas never hits oklab/oklch

// Fan layout using left/top/rotate only — html2canvas handles these better than translateX/Y+scale combos
function PosterFan({ items }: { items: StatsRawItem[] }) {
  const CW = 148; // center width
  const CH = 222; // center height
  const SW = 116; // side width
  const SH = 174; // side height
  const CONTAINER_W = 334; // card width - padding*2

  // Positions: center anchor, side posters overlap inward
  const centerLeft = (CONTAINER_W - CW) / 2; // 93px
  const sideOffset = 52; // how much side posters show from behind center

  return (
    <div style={{ position: "relative", width: CONTAINER_W, height: 250, margin: "0 auto" }}>
      {/* Left poster (#2) */}
      {items[1] && (
        <div style={{
          position: "absolute",
          width: SW,
          height: SH,
          left: centerLeft - SW + sideOffset,
          top: 30,
          overflow: "hidden",
          borderRadius: 14,
          transform: "rotate(-14deg)",
          transformOrigin: "bottom center",
          zIndex: 1,
          boxShadow: "0 20px 48px rgba(0,0,0,0.75)",
        }}>
          <img src={proxyUrl(items[1].poster_url) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      {/* Right poster (#3) */}
      {items[2] && (
        <div style={{
          position: "absolute",
          width: SW,
          height: SH,
          left: centerLeft + CW - sideOffset,
          top: 30,
          overflow: "hidden",
          borderRadius: 14,
          transform: "rotate(14deg)",
          transformOrigin: "bottom center",
          zIndex: 1,
          boxShadow: "0 20px 48px rgba(0,0,0,0.75)",
        }}>
          <img src={proxyUrl(items[2].poster_url) ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      {/* Center poster (#1) */}
      {items[0] && (
        <div style={{
          position: "absolute",
          width: CW,
          height: CH,
          left: centerLeft,
          top: 10,
          overflow: "hidden",
          borderRadius: 16,
          zIndex: 10,
          boxShadow: "0 0 0 2px rgba(45,212,191,0.55), 0 32px 64px rgba(0,0,0,0.85)",
        }}>
          <img src={proxyUrl(items[0].poster_url) ?? ""} alt={displayTitle(items[0])} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "16px 12px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <span
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
          textAlign: "center",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          textAlign: "center",
          fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function WrappedCard({
  year,
  films,
  seriesAnime,
  hours,
  topGenre,
  topPosters,
  total,
}: WrappedCardProps) {
  return (
    <div
      id="wrapped-card"
      style={{
        width: 390,
        height: 780,
        background: "linear-gradient(160deg, #0a0f0f 0%, #061a1a 35%, #08100f 60%, #050808 100%)",
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        flexShrink: 0,
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
      }}
    >
      {/* Ambient glow top-right */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      {/* Ambient glow bottom-left */}
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,212,191,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Year watermark */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 200,
          fontWeight: 900,
          color: "rgba(45,212,191,0.04)",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {year}
      </div>

      {/* Footer — always at bottom, outside flex flow */}
      <div style={{ position: "absolute", bottom: 24, left: 28, right: 28, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>hegon.fr</span>
        <span style={{ fontSize: 11, color: "rgba(45,212,191,0.4)", letterSpacing: "0.06em", fontWeight: 500 }}># {year}WRAP</span>
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", padding: "28px 28px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0.9, 0.6, 0.35].map((op, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: `rgba(45,212,191,${op})` }} />
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}>HEGON</span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(45,212,191,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Your {year} in review
          </p>
        </div>

        {/* Posters */}
        <div style={{ marginBottom: 20 }}>
          <PosterFan items={topPosters} />
        </div>

        {/* Tagline */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 300, color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>
            <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{total}</span>
            {" "}stories defined your year
          </p>
        </div>

        {/* 2×2 stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard value={films} label="Films" />
          <StatCard value={seriesAnime} label="Series & Anime" />
          <StatCard value={`${hours}h`} label="Hours watched" />
          <StatCard value={topGenre ?? "—"} label="Top Genre" />
        </div>

      </div>
    </div>
  );
}
