"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, Loader2 } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Legend {
  id: string;
  player_external_id: string;
  player_name: string;
  nationality: string | null;
  image_url: string | null;
  position: string | null;
  display_order: number;
  birth_date: string | null;
  birth_location: string | null;
  height: string | null;
  last_club: string | null;
}

interface SportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strNationality: string | null;
  strThumb: string | null;
  strCutout: string | null;
  strPosition: string | null;
  strDescriptionFR?: string | null;
  strDescriptionEN?: string | null;
  strBirthLocation?: string | null;
  dateBorn?: string | null;
  strTeam?: string | null;
  strHeight?: string | null;
  strWeight?: string | null;
  strSigning?: string | null;
}

interface FootballLegendsProps {
  userId: string;
  initialLegends?: Legend[];
}

const MAX_LEGENDS = 9;
const SLOTS = Array.from({ length: MAX_LEGENDS });

// ─── Player Search Modal ──────────────────────────────────────────────────────

function PlayerSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (p: SportsDBPlayer) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SportsDBPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setResults(
        ((data.player ?? []) as SportsDBPlayer[])
          .filter((p) => p.strNationality)
          .slice(0, 8),
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 380);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <Search size={15} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Maradona, Zidane, Pelé..."
            className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 outline-none"
          />
          {loading ? (
            <Loader2
              size={14}
              className="text-zinc-500 animate-spin shrink-0"
            />
          ) : (
            <button onClick={onClose}>
              <X size={15} className="text-zinc-600 hover:text-zinc-400" />
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">
              No results found
            </p>
          )}
          {query.length < 2 && (
            <p className="text-zinc-700 text-xs text-center py-8">
              Enter at least 2 characters
            </p>
          )}
          {results.map((p) => (
            <button
              key={p.idPlayer}
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50 last:border-0"
            >
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                {p.strThumb || p.strCutout ? (
                  <Image
                    src={p.strThumb || p.strCutout!}
                    alt={p.strPlayer}
                    fill
                    className="object-cover object-top"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                    {p.strPlayer.charAt(0)}
                  </div>
                )}
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  {p.strPlayer}
                </p>
                <p className="text-zinc-500 text-xs truncate">
                  {p.strNationality}
                  {p.strPosition ? ` · ${p.strPosition}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Legend Card ──────────────────────────────────────────────────────────────

function LegendCard({
  legend,
  isSelected,
  onClick,
  onRemove,
}: {
  legend: Legend;
  isSelected: boolean;
  onClick: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`group relative cursor-pointer rounded-lg overflow-hidden border transition-all duration-200 w-full h-full
        ${
          isSelected
            ? "border-red-500/50 shadow-lg shadow-red-500/10"
            : "border-zinc-800/60 hover:border-zinc-700/80"
        }`}
    >
      {/* grid overlay */}
      <div
        className="absolute inset-0 bg-zinc-950"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />

      <div className="relative w-full h-full">
        {legend.image_url ? (
          <Image
            src={legend.image_url}
            alt={legend.player_name}
            fill
            className="object-cover object-top grayscale"
            sizes="15vw"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
            <span className="text-zinc-600 text-xl font-black">
              {legend.player_name.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/20 to-transparent" />

        {/* top badges */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
          <span className="text-[7px] font-bold text-zinc-400 bg-black/70 px-1 py-0.5 rounded uppercase tracking-wider">
            {legend.nationality?.slice(0, 3) ?? "—"}
          </span>
          <span className="text-[6px] font-black text-red-500/80 border border-red-500/30 px-1 py-0.5 rounded uppercase tracking-wider">
            CLF
          </span>
        </div>

        {/* name */}
        <div className="absolute bottom-0 inset-x-0 p-1.5">
          <p className="text-white text-[8px] font-black uppercase tracking-wide leading-tight line-clamp-2">
            {legend.player_name.split(" ").slice(-1)[0]}
          </p>
          {legend.position && (
            <p className="text-zinc-500 text-[7px] uppercase tracking-widest">
              {legend.position.slice(0, 6)}
            </p>
          )}
        </div>

        {/* selected ring */}
        {isSelected && (
          <div className="absolute inset-0 ring-2 ring-red-500/50 rounded-lg pointer-events-none" />
        )}
      </div>

      {/* remove */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(legend.id);
        }}
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 border border-zinc-950 flex items-center justify-center z-20 shadow opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        <X size={7} className="text-white" />
      </button>
    </motion.div>
  );
}

// ─── Empty Slot ───────────────────────────────────────────────────────────────

function EmptySlot({
  canAdd,
  onClick,
}: {
  canAdd: boolean;
  onClick: () => void;
}) {
  if (!canAdd) {
    return (
      <div
        className="rounded-lg border border-zinc-800/30 bg-zinc-950/30 w-full h-full"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.008) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group cursor-pointer w-full h-full rounded-lg border border-dashed border-zinc-700/40
        hover:border-zinc-500/50 transition-all duration-200"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.008) 1px, transparent 1px)",
        backgroundSize: "10px 10px",
      }}
    >
      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
        <div
          className="w-6 h-6 rounded-full border border-dashed border-zinc-700/50 group-hover:border-zinc-500/60
          flex items-center justify-center transition-colors"
        >
          <Plus
            size={10}
            className="text-zinc-600 group-hover:text-zinc-400 transition-colors"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Player Description ───────────────────────────────────────────────────────

function PlayerDescription({ legend }: { legend: Legend | null }) {
  if (!legend) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-600 text-xs text-center italic">
          Select a player to view their profile
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={legend.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className="h-full flex flex-col gap-2"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-2 shrink-0">
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-wide leading-tight">
              {legend.player_name}
            </h3>
            <p className="text-zinc-500 text-[10px] mt-0.5">
              {[legend.nationality, legend.position]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="text-[6px] font-black text-red-500/60 border border-red-500/25 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0 mt-0.5">
            CLASSIFIED
          </span>
        </div>

        {/* stats grid */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          {legend.birth_date && (
            <div className="bg-zinc-900/60 rounded-lg px-2 py-1.5">
              <p className="text-zinc-600 text-[8px] uppercase tracking-widest">
                Born
              </p>
              <p className="text-zinc-300 text-[10px] font-semibold mt-0.5">
                {new Date(legend.birth_date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
          {legend.birth_location && (
            <div className="bg-zinc-900/60 rounded-lg px-2 py-1.5">
              <p className="text-zinc-600 text-[8px] uppercase tracking-widest">
                Origin
              </p>
              <p className="text-zinc-300 text-[10px] font-semibold mt-0.5 truncate">
                {legend.birth_location}
              </p>
            </div>
          )}
          {legend.height && (
            <div className="bg-zinc-900/60 rounded-lg px-2 py-1.5">
              <p className="text-zinc-600 text-[8px] uppercase tracking-widest">
                Height
              </p>
              <p className="text-zinc-300 text-[10px] font-semibold mt-0.5">
                {legend.height}
              </p>
            </div>
          )}
          {legend.last_club && (
            <div className="bg-zinc-900/60 rounded-lg px-2 py-1.5">
              <p className="text-zinc-600 text-[8px] uppercase tracking-widest">
                Club
              </p>
              <p className="text-emerald-400/80 text-[10px] font-semibold mt-0.5 truncate">
                {legend.last_club}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FootballLegends({
  userId,
  initialLegends = [],
}: FootballLegendsProps) {
  const supabase = createClient();

  const [legends, setLegends] = useState<Legend[]>(initialLegends);
  const [selectedLegend, setSelectedLegend] = useState<Legend | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // first empty slot index
  const firstEmptySlot = legends.length < MAX_LEGENDS ? legends.length : -1;

  const handlePlayerSelect = async (sp: SportsDBPlayer) => {
    if (legends.length >= MAX_LEGENDS) return;
    setSaving(true);
    try {
      // fetch détails complets
      const detailRes = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/lookupplayer.php?id=${sp.idPlayer}`,
      );
      const detailData = await detailRes.json();
      const detail = detailData.players?.[0] ?? {};

      const { data, error } = await supabase
        .schema("sport")
        .from("football_legends")
        .insert({
          user_id: userId,
          player_external_id: sp.idPlayer,
          player_name: sp.strPlayer,
          nationality: sp.strNationality,
          image_url: sp.strCutout || sp.strThumb || null,
          position: sp.strPosition,
          display_order: legends.length,
          birth_date: detail.dateBorn ?? null,
          birth_location: detail.strBirthLocation ?? null,
          height: detail.strHeight ?? null,
          last_club: detail.strTeam ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setLegends((prev) => [...prev, data]);
      setSelectedLegend(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setShowModal(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await supabase
        .schema("sport")
        .from("football_legends")
        .delete()
        .eq("id", id);
      setLegends((prev) => prev.filter((l) => l.id !== id));
      if (selectedLegend?.id === id) setSelectedLegend(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* grille fixe 3x3 — hauteur absolue fixe */}
      <div
        className="grid grid-cols-3 gap-1.5 shrink-0"
        style={{
          gridTemplateRows: "repeat(3, minmax(0, 1fr))",
          height: "min(55vh, 450px)",
        }}
      >
        {SLOTS.map((_, i) => {
          const legend = legends[i] ?? null;
          const isFirstEmpty = i === firstEmptySlot;

          if (legend) {
            return (
              <LegendCard
                key={legend.id}
                legend={legend}
                isSelected={selectedLegend?.id === legend.id}
                onClick={() =>
                  setSelectedLegend((prev) =>
                    prev?.id === legend.id ? null : legend,
                  )
                }
                onRemove={handleRemove}
              />
            );
          }

          return (
            <EmptySlot
              key={i}
              canAdd={isFirstEmpty}
              onClick={() => isFirstEmpty && setShowModal(true)}
            />
          );
        })}
      </div>

      {/* divider */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-zinc-700 text-[8px] uppercase tracking-widest font-bold">
          Profile
        </span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* description — bottom, height fit */}
      <div
        className="mt-auto shrink-0 bg-zinc-900/30 rounded-xl border border-zinc-800/40 p-3"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        <PlayerDescription legend={selectedLegend} />
      </div>

      <AnimatePresence>
        {showModal && (
          <PlayerSearchModal
            onSelect={handlePlayerSelect}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>

      {saving && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 size={24} className="text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
