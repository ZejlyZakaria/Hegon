/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { StatsRawItem } from "../../service";
import { displayTitle } from "../../utils";

// Route images through a same-origin proxy → no CORS issues for html-to-image
function proxyUrl(url: string | null): string | null {
  if (!url) return null;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface WrappedCardProps {
  year: number;
  films: number;
  seriesAnime: number;
  hours: number;
  unknownDurationEvents?: number;
  topGenre: string | null;
  topPosters: StatsRawItem[];
  total: number;
}

// All inline styles — no Tailwind classes — so html-to-image never hits oklab/oklch

/** A stable ranking explored as a circular, manual three-poster fan. */
function PosterFan({ items }: { items: StatsRawItem[] }) {
  const [center,setCenter]=useState(0);
  if (!items.length) return <div style={{height:276,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(255,255,255,0.5)"}}>No rated first viewings yet</div>;
  const active=center % Math.max(1,items.length);
  const move=(step:number)=>setCenter(n=>(n+step+items.length)%items.length);
  const slots=items.length<2 ? [0] : items.length===2 ? [0,1] : [-1,0,1];
  return <div aria-label="Your highest-rated first viewings" aria-roledescription="carousel" style={{width:334,margin:"0 auto"}}>
    <div style={{position:"relative",height:236}} onKeyDown={e=>{
      if(items.length<2 || (e.key!=="ArrowRight" && e.key!=="ArrowLeft"))return;
      e.preventDefault();move(e.key==="ArrowRight" ? 1:-1);
      const root=e.currentTarget;
      requestAnimationFrame(()=>root.querySelector<HTMLButtonElement>("[aria-current=true]")?.focus());
    }}>
      {slots.map(offset=>{
        const index=(active+offset+items.length)%items.length,item=items[index];if(!item)return null;
        const middle=offset===0;
        return <button className="motion-reduce:transition-none" key={item.id} type="button" aria-label={middle ? `${displayTitle(item)}, ${item.user_rating ?? "unrated"} out of 10, ${index+1} of ${items.length}` : `Show ${displayTitle(item)}`} aria-current={middle ? "true":undefined} onClick={()=>{if(!middle)move(offset);}} style={{transition:"left 260ms ease, top 260ms ease, width 260ms ease, height 260ms ease, transform 260ms ease",position:"absolute",width:middle ? 148:116,height:middle ? 222:174,left:middle ? 93:offset<0 ? 29:189,top:middle ? 10:30,padding:0,border:0,overflow:"hidden",borderRadius:middle ? 16:12,transform:middle ? undefined:`rotate(${offset*14}deg)`,transformOrigin:"bottom center",zIndex:middle ? 10:1,cursor:middle ? "default":"pointer",background:"#1e1e22",boxShadow:middle ? "0 0 0 2px rgba(45,212,191,0.55), 0 32px 64px rgba(0,0,0,0.85)":"0 20px 48px rgba(0,0,0,0.75)"}}>
          <img src={proxyUrl(item.poster_url) ?? ""} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
        </button>;
      })}
    </div>
    {items[active] && <div aria-live="polite" style={{textAlign:"center",height:40,fontSize:11,color:"rgba(255,255,255,0.65)"}}><div style={{overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",color:"#fff"}}>{displayTitle(items[active])}</div><span style={{color:"#2dd4bf"}}>{items[active].user_rating} / 10</span>{items.length>1 && <span style={{marginLeft:12}}>{active+1} / {items.length}</span>}</div>}
  </div>;
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
  unknownDurationEvents,
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
          <PosterFan key={topPosters.map(i=>i.id).join(":")} items={topPosters} />
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
          <StatCard value={`${Math.round(hours * 10) / 10}h`} label={unknownDurationEvents ? "Known hours watched" : "Hours watched"} />
          <StatCard value={topGenre ?? "—"} label="Top Genre" />
        </div>

      </div>
    </div>
  );
}
