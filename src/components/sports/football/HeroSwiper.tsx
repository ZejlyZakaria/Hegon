"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ShieldAlert, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import FootballTeamSearchModal from "@/components/sports/football/FootballTeamSearchModal";
import FootballRemoveConfirmModal from "@/components/sports/football/FootballRemoveConfirmModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  start_time: string;
  competition_name: string;
  home_team_name: string;
  away_team_name: string;
}

interface TeamHero {
  team: { id: string; name: string; crest_url: string | null };
  isMainTeam: boolean;
  nextMatch: Match | null;
}

interface HeroSwiperProps {
  teamHeroes: TeamHero[];
  userId: string;
  favoriteTeamIds: string[];
}

const SLIDE_DURATION = 7000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCompetitionName(name?: string) {
  if (!name) return "";
  if (name === "Primera Division") return "La Liga";
  return name;
}

function getCompetitionLogo(name: string) {
  const map: Record<string, string> = {
    "Primera Division": "/LaLiga-logo.png",
    "UEFA Champions League": "/UEFA-logo.png",
    "Premier League": "/pl.png",
  };
  return map[name] || "/LaLiga-logo.svg";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

// ─── Progress Bars ────────────────────────────────────────────────────────────

function ProgressBars({ total, activeIndex, paused, onDotClick }: {
  total: number; activeIndex: number; paused: boolean; onDotClick: (i: number) => void;
}) {
  return (
    <div className="absolute bottom-3 left-4 right-4 z-20 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onDotClick(i)}
          className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20 cursor-pointer">
          {i < activeIndex ? (
            <div className="h-full w-full bg-emerald-400/80" />
          ) : i === activeIndex ? (
            <div className="h-full bg-emerald-400 rounded-full origin-left"
              style={{ animation: paused ? "none" : `progress-fill ${SLIDE_DURATION}ms linear forwards` }} />
          ) : (
            <div className="h-full w-0 bg-emerald-400/80" />
          )}
        </button>
      ))}
      <style>{`@keyframes progress-fill { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}

// ─── Empty Hero ───────────────────────────────────────────────────────────────

function EmptyHero({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative h-72 md:h-60 rounded-2xl overflow-hidden border border-white/10">
      <div className="absolute inset-0 bg-zinc-900" />
      <Image src="/image.png" alt="Football" fill priority
        className="object-cover opacity-30" quality={75} />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute top-4 left-4 z-10">
        <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Équipes favorites</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm text-white font-semibold text-sm cursor-pointer">
          <Plus size={16} />
          Add a team
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HeroSwiper({ teamHeroes, userId, favoriteTeamIds }: HeroSwiperProps) {
  const router   = useRouter();
  const supabase = createClient();
  const swiperRef = useRef<SwiperType | null>(null);

  const [activeIndex, setActiveIndex]   = useState(0);
  const [paused, setPaused]             = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeTeam, setRemoveTeam]     = useState<TeamHero["team"] | null>(null);
  const [localHeroes, setLocalHeroes]   = useState<TeamHero[]>(teamHeroes);
  const [localFavIds, setLocalFavIds]   = useState<string[]>(favoriteTeamIds);
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);

  const handleSlideChange = (swiper: SwiperType) => setActiveIndex(swiper.realIndex);
  const handleDotClick    = (i: number) => swiperRef.current?.slideToLoop(i);

  // ── Ajouter une équipe ─────────────────────────────────────────────────────
  const handleTeamAdded = (team: { id: string; name: string; crest_url: string | null }) => {
    const newHero: TeamHero = {
      team: { id: team.id, name: team.name, crest_url: team.crest_url },
      isMainTeam: false,
      nextMatch: null,
    };
    setLocalHeroes(prev => [...prev, newHero]);
    setLocalFavIds(prev => [...prev, team.id]);
    router.refresh();
  };

  // ── Supprimer une équipe ───────────────────────────────────────────────────
  const handleRemoveConfirm = async (teamId: string) => {
    try {
      await supabase.schema("sport").from("user_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("entity_type", "football_team")
        .eq("entity_id", teamId);

      setLocalHeroes(prev => prev.filter(h => h.team.id !== teamId));
      setLocalFavIds(prev => prev.filter(id => id !== teamId));
      setRemoveTeam(null);
      router.refresh();
    } catch (err) { console.error(err); }
  };

  if (!localHeroes.length) {
    return (
      <>
        <EmptyHero onAdd={() => setAddModalOpen(true)} />
        <FootballTeamSearchModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          userId={userId}
          currentFavoriteIds={localFavIds}
          onTeamAdded={handleTeamAdded}
        />
      </>
    );
  }

  return (
    <>
      <div
        className="relative h-72 md:h-60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10"
        onMouseEnter={() => { setPaused(true); swiperRef.current?.autoplay.pause(); }}
        onMouseLeave={() => { setPaused(false); swiperRef.current?.autoplay.resume(); setHoveredTeamId(null); }}
      >
        {/* label équipes favorites */}
        <div className="absolute top-4 left-4 z-30">
          <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
            Favorite Teams
          </span>
        </div>

        {/* bouton ajouter */}
        <div className="absolute top-3 right-4 z-30">
          <Button size="sm" variant="outline" onClick={() => setAddModalOpen(true)}
            className="bg-black/40 border-white/15 text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white hover:border-white/30 text-xs gap-1.5">
            <Plus size={12} />
            Add a team
          </Button>
        </div>

        <Swiper
          modules={[Autoplay, EffectFade]}
          slidesPerView={1}
          autoplay={{ delay: SLIDE_DURATION, disableOnInteraction: false }}
          loop effect="fade" fadeEffect={{ crossFade: true }} speed={900}
          className="h-full w-full"
          onSwiper={swiper => { swiperRef.current = swiper; }}
          onSlideChange={handleSlideChange}
        >
          {localHeroes.map(({ team, isMainTeam, nextMatch }) => (
            <SwiperSlide key={team.id} className="relative">
              <div className="absolute inset-0 bg-zinc-900" />
              <Image src="/image.png" alt="Background" fill priority
                className="object-cover" quality={75} />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.2),rgba(0,0,0,0.8))]" />
              <div className="absolute inset-0 noise-background" />

              <div className="relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-between h-full p-4 md:p-8 gap-6 md:gap-4 pt-10 md:pt-8">

                {/* team header avec bouton suppression au hover */}
                <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                  <div
                    className="relative group/crest"
                    onMouseEnter={() => setHoveredTeamId(team.id)}
                    onMouseLeave={() => setHoveredTeamId(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}
                      className="relative h-16 w-16 md:h-24 md:w-24 shrink-0"
                    >
                      <Image src={team.crest_url || "/placeholder-logo.svg"} alt={team.name}
                        fill priority className="object-contain drop-shadow-2xl" />
                    </motion.div>

                    {/* bouton suppression au hover du crest */}
                    <AnimatePresence>
                      {hoveredTeamId === team.id && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setRemoveTeam(team)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-zinc-950 flex items-center justify-center shadow-lg z-10"
                        >
                          <X size={9} className="text-white" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    {isMainTeam && (
                      <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.35 }}
                        className="text-xs font-bold text-emerald-300 tracking-widest">
                        MAIN TEAM
                      </motion.span>
                    )}
                    <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.35 }}
                      className="text-2xl md:text-4xl font-extrabold tracking-tight text-white">
                      {team.name}
                    </motion.h2>
                  </div>
                </div>

                {/* prochain match */}
                <div className="w-full md:w-auto">
                  {nextMatch ? (
                    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                      className="flex flex-col items-center md:items-end text-center md:text-right">
                      <div className="flex items-center gap-4">
                        <div className="order-2 md:order-1">
                          <p className="text-sm uppercase tracking-wider text-emerald-300 font-semibold">
                            Next Match
                          </p>
                          <p className="text-base md:text-lg font-bold text-white">
                            {nextMatch.home_team_name} vs {nextMatch.away_team_name}
                          </p>
                        </div>
                        <div className="relative w-10 h-10 shrink-0 order-1 md:order-2">
                          <Image src={getCompetitionLogo(nextMatch.competition_name)}
                            alt={nextMatch.competition_name} fill priority
                            className="object-contain bg-white rounded-md p-1" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs md:text-sm text-zinc-300">
                        <Calendar size={14} />
                        <span>{formatCompetitionName(nextMatch.competition_name)}</span>
                        <span className="text-zinc-500">•</span>
                        <span>{formatDate(nextMatch.start_time)}</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.4 }}
                      className="flex items-center gap-3 text-zinc-400">
                      <ShieldAlert size={20} />
                      <p>No upcoming match</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {localHeroes.length > 1 && (
          <ProgressBars key={activeIndex}
            total={localHeroes.length} activeIndex={activeIndex}
            paused={paused} onDotClick={handleDotClick} />
        )}
      </div>

      {/* Modals */}
      <FootballTeamSearchModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        userId={userId}
        currentFavoriteIds={localFavIds}
        onTeamAdded={handleTeamAdded}
      />

      <FootballRemoveConfirmModal
        open={!!removeTeam}
        team={removeTeam}
        onClose={() => setRemoveTeam(null)}
        onConfirm={handleRemoveConfirm}
      />
    </>
  );
}