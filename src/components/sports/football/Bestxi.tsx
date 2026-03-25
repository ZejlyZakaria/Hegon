"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  nationality: string | null;
  image_url: string | null;
  position_key: string;
  is_substitute: boolean;
  substitute_order?: number;
}

interface SportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strNationality: string | null;
  strThumb: string | null;
  strCutout: string | null;
  strPosition: string | null;
}

interface BestXIProps {
  userId: string;
  initialFormation?: string;
  initialPlayers?: Player[];
  bestXiId?: string | null;
}

// ─── Formations ───────────────────────────────────────────────────────────────

const FORMATIONS: Record<string, { label: string; positions: string[] }> = {
  "4-3-3":   { label: "4-3-3",   positions: ["GK","RB","CB_R","CB_L","LB","CM_R","CM_C","CM_L","RW","ST","LW"] },
  "4-4-2":   { label: "4-4-2",   positions: ["GK","RB","CB_R","CB_L","LB","RM","CM_R","CM_L","LM","ST_R","ST_L"] },
  "4-2-3-1": { label: "4-2-3-1", positions: ["GK","RB","CB_R","CB_L","LB","CDM_R","CDM_L","CAM_R","CAM_C","CAM_L","ST"] },
  "3-5-2":   { label: "3-5-2",   positions: ["GK","CB_R","CB_C","CB_L","RM","CM_R","CM_C","CM_L","LM","ST_R","ST_L"] },
  "5-3-2":   { label: "5-3-2",   positions: ["GK","RWB","CB_R","CB_C","CB_L","LWB","CM_R","CM_C","CM_L","ST_R","ST_L"] },
  "4-5-1":   { label: "4-5-1",   positions: ["GK","RB","CB_R","CB_L","LB","RM","CM_R","CM_C","CM_L","LM","ST"] },
};

const POSITION_GROUP: Record<string, number> = {
  GK:0, LB:1, CB_L:1, CB_C:1, CB_R:1, RB:1, LWB:1, RWB:1,
  CDM_L:2, CDM_R:2, LM:2, CM_L:2, CM_C:2, CM_R:2, RM:2,
  CAM_L:3, CAM_C:3, CAM_R:3, LW:3, RW:3,
  ST:4, ST_L:4, ST_R:4,
};

const POSITION_X_APPROX: Record<string, number> = {
  GK:50, LB:10, CB_L:30, CB_C:50, CB_R:70, RB:90, LWB:8, RWB:92,
  CDM_L:36, CDM_R:64, LM:10, CM_L:30, CM_C:50, CM_R:70, RM:90,
  CAM_L:28, CAM_C:50, CAM_R:72, LW:10, RW:90,
  ST:50, ST_L:33, ST_R:67,
};

// ─── Remap formation ──────────────────────────────────────────────────────────

function remapPlayersToFormation(
  currentPlayers: Record<string, Player>,
  newFormationPositions: string[],
): Record<string, Player> {
  const result: Record<string, Player> = {};
  for (const [k, v] of Object.entries(currentPlayers)) {
    if (k.startsWith("SUB_")) result[k] = v;
  }
  const newPosSet = new Set(newFormationPositions);
  const availableSlots = new Set(newFormationPositions);
  for (const [k, player] of Object.entries(currentPlayers)) {
    if (k.startsWith("SUB_")) continue;
    if (newPosSet.has(k)) {
      result[k] = { ...player, position_key: k };
      availableSlots.delete(k);
    }
  }
  const orphans = Object.entries(currentPlayers)
    .filter(([k]) => !k.startsWith("SUB_") && !newPosSet.has(k))
    .map(([, v]) => v);
  for (const player of orphans) {
    const group = POSITION_GROUP[player.position_key] ?? 2;
    const srcX  = POSITION_X_APPROX[player.position_key] ?? 50;
    let bestSlot: string | null = null;
    let bestScore = Infinity;
    for (const slot of availableSlots) {
      const score = Math.abs((POSITION_GROUP[slot] ?? 2) - group) * 1000
                  + Math.abs((POSITION_X_APPROX[slot] ?? 50) - srcX);
      if (score < bestScore) { bestScore = score; bestSlot = slot; }
    }
    if (bestSlot) {
      result[bestSlot] = { ...player, position_key: bestSlot };
      availableSlots.delete(bestSlot);
    }
  }
  return result;
}

// ─── Position coords — terrain complet ───────────────────────────────────────

const POSITION_COORDS: Record<string, { x: number; y: number; label: string }> = {
  GK:    { x: 50, y: 91, label: "GB"  },
  RB:    { x: 83, y: 76, label: "DD"  },
  CB_R:  { x: 63, y: 79, label: "DC"  },
  CB_C:  { x: 50, y: 79, label: "DC"  },
  CB_L:  { x: 37, y: 79, label: "DC"  },
  LB:    { x: 17, y: 76, label: "DG"  },
  RWB:   { x: 87, y: 72, label: "PD"  },
  LWB:   { x: 13, y: 72, label: "PG"  },
  CDM_R: { x: 62, y: 64, label: "MDC" },
  CDM_L: { x: 38, y: 64, label: "MDC" },
  RM:    { x: 85, y: 50, label: "MD"  },
  CM_R:  { x: 68, y: 54, label: "MC"  },
  CM_C:  { x: 50, y: 57, label: "MC"  },
  CM_L:  { x: 32, y: 54, label: "MC"  },
  LM:    { x: 15, y: 50, label: "MG"  },
  CAM_R: { x: 68, y: 40, label: "MOA" },
  CAM_C: { x: 50, y: 38, label: "MOA" },
  CAM_L: { x: 32, y: 40, label: "MOA" },
  RW:    { x: 83, y: 24, label: "AD"  },
  LW:    { x: 17, y: 24, label: "AG"  },
  ST:    { x: 50, y: 13, label: "BU"  },
  ST_R:  { x: 66, y: 13, label: "BU"  },
  ST_L:  { x: 34, y: 13, label: "BU"  },
};

const SUBSTITUTES_COUNT = 7;

// ─── Full Pitch SVG ───────────────────────────────────────────────────────────

function FullPitch() {
  const W = 100; const H = 110;
  const m = 2;
  const pW = W - 2*m; const pH = H - 2*m;
  const midY = m + pH/2;
  const cr = (9.15/105)*pH;
  const b18W = (40.32/68)*pW; const b18H = (16.5/105)*pH;
  const b18X = m + (pW-b18W)/2;
  const b6W = (18.32/68)*pW; const b6H = (5.5/105)*pH;
  const b6X = m + (pW-b6W)/2;
  const penTop = m + (11/105)*pH;
  const penBot = m + pH - (11/105)*pH;
  const arcDxTop = Math.sqrt(Math.max(0, cr*cr - (m+b18H-penTop)**2));
  const arcDxBot = Math.sqrt(Math.max(0, cr*cr - (m+pH-b18H-penBot)**2));
  const gW = (7.32/68)*pW; const gD = 2;
  const gX = m + (pW-gW)/2;
  const s = "rgba(255,255,255,0.28)"; const sw = "0.5";

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <rect x={m} y={m} width={pW} height={pH} fill="none" stroke={s} strokeWidth={sw} rx="0.4" />
      <line x1={m} y1={midY} x2={W-m} y2={midY} stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      <circle cx="50" cy={midY} r={cr} fill="none" stroke={s} strokeWidth={sw} />
      <circle cx="50" cy={midY} r="0.65" fill="rgba(255,255,255,0.45)" />
      {/* surface haut */}
      <rect x={b18X} y={m} width={b18W} height={b18H} fill="none" stroke={s} strokeWidth={sw} rx="0.3" />
      <path d={`M ${50-arcDxTop} ${m+b18H} A ${cr} ${cr} 0 0 0 ${50+arcDxTop} ${m+b18H}`} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={sw} />
      <rect x={b6X} y={m} width={b6W} height={b6H} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={sw} rx="0.3" />
      <rect x={gX} y={m-gD} width={gW} height={gD} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.6" rx="0.2" />
      <circle cx="50" cy={penTop} r="0.65" fill="rgba(255,255,255,0.40)" />
      {/* surface bas */}
      <rect x={b18X} y={m+pH-b18H} width={b18W} height={b18H} fill="none" stroke={s} strokeWidth={sw} rx="0.3" />
      <path d={`M ${50-arcDxBot} ${m+pH-b18H} A ${cr} ${cr} 0 0 1 ${50+arcDxBot} ${m+pH-b18H}`} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={sw} />
      <rect x={b6X} y={m+pH-b6H} width={b6W} height={b6H} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={sw} rx="0.3" />
      <rect x={gX} y={m+pH} width={gW} height={gD} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.6" rx="0.2" />
      <circle cx="50" cy={penBot} r="0.65" fill="rgba(255,255,255,0.40)" />
      {/* arcs de coin */}
      {[
        `M ${m} ${m+4} A 4 4 0 0 1 ${m+4} ${m}`,
        `M ${W-m-4} ${m} A 4 4 0 0 1 ${W-m} ${m+4}`,
        `M ${m} ${H-m-4} A 4 4 0 0 0 ${m+4} ${H-m}`,
        `M ${W-m-4} ${H-m} A 4 4 0 0 0 ${W-m} ${H-m-4}`,
      ].map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={sw} />)}
    </svg>
  );
}

// ─── Player Slot ──────────────────────────────────────────────────────────────

function PlayerSlot({ player, positionKey, positionLabel, x, y, onAdd, onRemove, isDragging, onDragStart, onDragOver, onDrop }: {
  player: Player | null; positionKey: string; positionLabel: string;
  x: number; y: number;
  onAdd: (k: string) => void; onRemove: (k: string) => void;
  isDragging: boolean; onDragStart: (k: string) => void;
  onDragOver: (e: React.DragEvent) => void; onDrop: (k: string) => void;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group z-10"
      style={{ left: `${x}%`, top: `${y}%` }}
      onDragOver={onDragOver} onDrop={() => onDrop(positionKey)}
    >
      <div className="relative">
        <motion.div
          layout draggable={!!player}
          onDragStart={() => onDragStart(positionKey)}
          whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.95 }}
          onClick={() => !player && onAdd(positionKey)}
          className={`relative w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full border-2 cursor-pointer
            flex items-center justify-center overflow-hidden transition-all duration-200
            ${player ? "border-emerald-400/70 shadow-lg shadow-emerald-500/20" : "border-dashed border-white/25 hover:border-emerald-400/60 bg-black/25"}
            ${isDragging ? "opacity-30 scale-90" : ""}`}
        >
          {player ? (
            <>
              {player.image_url
                ? <Image src={player.image_url} alt={player.name} fill className="object-cover object-top" sizes="44px" />
                : <div className="w-full h-full bg-linear-to-br from-zinc-600 to-zinc-900 flex items-center justify-center">
                    <span className="text-white font-black">{player.name.charAt(0)}</span>
                  </div>
              }
              <div className="absolute inset-0 rounded-full ring-2 ring-emerald-400/40 pointer-events-none" />
            </>
          ) : (
            <Plus size={14} className="text-white/30 group-hover:text-emerald-400/80 transition-colors" />
          )}
        </motion.div>
        {player && (
          <button onClick={e => { e.stopPropagation(); onRemove(positionKey); }}
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-zinc-950
              flex items-center justify-center z-20 shadow opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={7} className="text-white" />
          </button>
        )}
      </div>
      <div className="text-center pointer-events-none">
        {player && <p className="text-white text-[9px] font-bold leading-tight max-w-15 truncate drop-shadow-sm">{player.name.split(" ").slice(-1)[0]}</p>}
        <p className="text-white/30 text-[7px] font-semibold uppercase tracking-widest">{positionLabel}</p>
      </div>
    </div>
  );
}

// ─── Substitute Slot — vertical list ─────────────────────────────────────────

function SubstituteSlot({ player, index, onAdd, onRemove, onDragStart, onDragOver, onDrop }: {
  player: Player | null; index: number;
  onAdd: (k: string) => void; onRemove: (k: string) => void;
  onDragStart: (k: string) => void;
  onDragOver: (e: React.DragEvent) => void; onDrop: (k: string) => void;
}) {
  const key = `SUB_${index}`;
  return (
    <div className="group flex flex-col items-center gap-0.5 w-full"
      onDragOver={onDragOver} onDrop={() => onDrop(key)}>
      <div className="relative">
        <motion.div
          layout draggable={!!player}
          onDragStart={() => onDragStart(key)}
          whileHover={{ scale: 1.06 }}
          onClick={() => !player && onAdd(key)}
          className={`relative w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full border-2 cursor-pointer
            flex items-center justify-center overflow-hidden transition-all duration-200
            ${player ? "border-zinc-500/70 shadow-md" : "border-dashed border-zinc-700/60 hover:border-zinc-500/70 bg-zinc-900/50"}`}
        >
          {player ? (
            player.image_url
              ? <Image src={player.image_url} alt={player.name} fill className="object-cover object-top" sizes="36px" />
              : <div className="w-full h-full bg-linear-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">{player.name.charAt(0)}</span>
                </div>
          ) : (
            <Plus size={11} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          )}
        </motion.div>
        {player && (
          <button onClick={e => { e.stopPropagation(); onRemove(key); }}
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border border-zinc-950
              flex items-center justify-center z-10 shadow opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={6} className="text-white" />
          </button>
        )}
      </div>
      {player && (
        <p className="text-zinc-500 text-[8px] font-semibold max-w-10 truncate text-center leading-tight">
          {player.name.split(" ").slice(-1)[0]}
        </p>
      )}
    </div>
  );
}

// ─── Player Search Modal ──────────────────────────────────────────────────────

function PlayerSearchModal({ onSelect, onClose }: {
  onSelect: (p: SportsDBPlayer) => void; onClose: () => void;
}) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SportsDBPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(((data.player ?? []) as SportsDBPlayer[]).filter(p => p.strNationality).slice(0, 8));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 380);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <Search size={15} className="text-zinc-500 shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Maradona, Zidane, Ronaldo..."
            className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 outline-none" />
          {loading
            ? <Loader2 size={14} className="text-zinc-500 animate-spin shrink-0" />
            : <button onClick={onClose}><X size={15} className="text-zinc-600 hover:text-zinc-400" /></button>
          }
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">Aucun résultat</p>
          )}
          {query.length < 2 && (
            <p className="text-zinc-700 text-xs text-center py-8">Tape au moins 2 caractères</p>
          )}
          {results.map(p => (
            <button key={p.idPlayer} onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50 last:border-0">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                {p.strThumb || p.strCutout
                  ? <Image src={p.strThumb || p.strCutout!} alt={p.strPlayer} fill className="object-cover object-top" sizes="40px" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">{p.strPlayer.charAt(0)}</div>
                }
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">{p.strPlayer}</p>
                <p className="text-zinc-500 text-xs truncate">{p.strNationality}{p.strPosition ? ` · ${p.strPosition}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function BestXI({
  userId,
  initialFormation = "4-3-3",
  initialPlayers = [],
  bestXiId: initialBestXiId = null,
}: BestXIProps) {
  const supabase = createClient();

  const [formation, setFormation]       = useState(initialFormation);
  const [players, setPlayers]           = useState<Record<string, Player>>({});
  const [bestXiId, setBestXiId]         = useState<string | null>(initialBestXiId);
  const [searchTarget, setSearchTarget] = useState<string | null>(null);
  const [dragSource, setDragSource]     = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    const map: Record<string, Player> = {};
    for (const p of initialPlayers) map[p.position_key] = p;
    setPlayers(map);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const positions    = FORMATIONS[formation].positions;
  const substitutes  = Array.from({ length: SUBSTITUTES_COUNT }, (_, i) => players[`SUB_${i}`] ?? null);
  const starterCount = Object.values(players).filter(p => !p.is_substitute).length;
  const subCount     = substitutes.filter(Boolean).length;

  const handleFormationChange = (f: string) => {
    setPlayers(prev => remapPlayersToFormation(prev, FORMATIONS[f].positions));
    setFormation(f);
  };

  const handlePlayerSelect = (sp: SportsDBPlayer) => {
    if (!searchTarget) return;
    setPlayers(prev => ({
      ...prev,
      [searchTarget]: {
        id: sp.idPlayer, name: sp.strPlayer, nationality: sp.strNationality,
        image_url: sp.strCutout || sp.strThumb || null,
        position_key: searchTarget,
        is_substitute: searchTarget.startsWith("SUB_"),
        substitute_order: searchTarget.startsWith("SUB_") ? parseInt(searchTarget.split("_")[1]) : undefined,
      },
    }));
    setSearchTarget(null);
  };

  const handleRemove    = (k: string) => setPlayers(prev => { const n = { ...prev }; delete n[k]; return n; });
  const handleDragStart = (k: string) => setDragSource(k);
  const handleDragOver  = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetKey: string) => {
    if (!dragSource || dragSource === targetKey) { setDragSource(null); return; }
    setPlayers(prev => {
      const next = { ...prev };
      const src = next[dragSource]; const tgt = next[targetKey];
      if (src) next[targetKey] = { ...src, position_key: targetKey, is_substitute: targetKey.startsWith("SUB_") };
      else delete next[targetKey];
      if (tgt) next[dragSource] = { ...tgt, position_key: dragSource, is_substitute: dragSource.startsWith("SUB_") };
      else delete next[dragSource];
      return next;
    });
    setDragSource(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let xiId = bestXiId;
      if (!xiId) {
        const { data } = await supabase.schema("sport").from("football_best_xi")
          .insert({ user_id: userId, formation, substitutes_count: SUBSTITUTES_COUNT })
          .select("id").single();
        xiId = data?.id ?? null;
        if (xiId) setBestXiId(xiId);
      } else {
        await supabase.schema("sport").from("football_best_xi")
          .update({ formation, updated_at: new Date().toISOString() }).eq("id", xiId);
      }
      if (!xiId) throw new Error("No XI id");
      await supabase.schema("sport").from("football_best_xi_players").delete().eq("best_xi_id", xiId);
      const rows = Object.values(players).map(p => ({
        best_xi_id: xiId, player_external_id: p.id, player_name: p.name,
        nationality: p.nationality, image_url: p.image_url,
        position_key: p.position_key, is_substitute: p.is_substitute,
        substitute_order: p.substitute_order ?? null,
      }));
      if (rows.length > 0) await supabase.schema("sport").from("football_best_xi_players").insert(rows);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error("Save error:", err); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full">

      {/* ── header responsive ── */}
      <div className="flex flex-col gap-2">
        {/* ligne 1 — formation + save */}
        <div className="flex items-center justify-between gap-3">
          <Select value={formation} onValueChange={handleFormationChange}>
            <SelectTrigger className="w-28 h-9 bg-zinc-900 border-zinc-700/60 text-white text-sm font-bold focus:ring-0 focus:ring-offset-0 hover:border-zinc-600 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700/60">
              {Object.keys(FORMATIONS).map(f => (
                <SelectItem key={f} value={f}
                  className={`text-sm font-semibold cursor-pointer focus:bg-zinc-800 ${f === formation ? "text-emerald-400" : "text-zinc-300"}`}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className={`gap-1.5 text-xs font-bold transition-all duration-300 ${
              saved
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
            }`}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saved ? "Sauvegardé !" : "Sauvegarder"}
          </Button>
        </div>

        {/* ligne 2 — compteurs */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-500">Titulaires</span>
            <span className="font-black text-emerald-400">{starterCount}</span>
            <span className="text-zinc-700">/11</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span className="text-zinc-500">Remplaçants</span>
            <span className="font-black text-zinc-300">{subCount}</span>
            <span className="text-zinc-700">/{SUBSTITUTES_COUNT}</span>
          </div>
        </div>
      </div>

      {/* ── terrain + remplaçants ── */}
      <div className="flex flex-col md:flex-row gap-2 flex-1 min-h-0">

        {/* terrain — 85% */}
        <div className="relative rounded-2xl overflow-hidden" style={{ flex: "0 0 80%" }}>
          {/* herbe */}
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, #1d6b31 0%, #1a5e2b 45%, #185525 100%)" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="absolute inset-x-0" style={{
                top: `${i*(100/6)}%`, height: `${100/6}%`,
                background: i%2===0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.045)",
              }} />
            ))}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.35)_100%)]" />
          </div>
          <FullPitch />
          {positions.map(posKey => {
            const coord = POSITION_COORDS[posKey];
            if (!coord) return null;
            return (
              <PlayerSlot key={posKey}
                player={players[posKey] ?? null}
                positionKey={posKey} positionLabel={coord.label}
                x={coord.x} y={coord.y}
                onAdd={setSearchTarget} onRemove={handleRemove}
                isDragging={dragSource === posKey}
                onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
              />
            );
          })}
          {/* padding bottom pour ratio terrain complet */}
          <div className="block md:hidden" style={{ paddingBottom: "100%" }} /><div className="hidden sm:block md:hidden" style={{ paddingBottom: "100%" }} /><div className="hidden md:block" style={{ paddingBottom: "110%" }} />
        </div>

        {/* remplaçants — 15% — colonne verticale */}
        <div className="hidden md:flex flex-col items-center gap-2 py-2 overflow-y-auto" style={{ flex: "0 0 20%" }}>
          <span className="text-zinc-600 text-[8px] font-bold uppercase tracking-widest text-center mb-1">
            Rempl.
          </span>
          {Array.from({ length: SUBSTITUTES_COUNT }).map((_, i) => (
            <SubstituteSlot key={i}
              player={substitutes[i]} index={i}
              onAdd={setSearchTarget} onRemove={handleRemove}
              onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
            />
          ))}
        </div>

        {/* remplaçants mobile/md — horizontal scroll */}
        <div className="flex md:hidden items-center gap-3 overflow-x-auto pb-2 scrollbar-none px-1 pt-1">
          {Array.from({ length: SUBSTITUTES_COUNT }).map((_, i) => (
            <div key={i} className="shrink-0">
              <SubstituteSlot
                player={substitutes[i]} index={i}
                onAdd={setSearchTarget} onRemove={handleRemove}
                onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
              />
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {searchTarget && (
          <PlayerSearchModal onSelect={handlePlayerSelect} onClose={() => setSearchTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}