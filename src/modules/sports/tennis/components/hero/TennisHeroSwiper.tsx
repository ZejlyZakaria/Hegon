"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Trophy, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { createClient } from "@/infrastructure/supabase/client"
import TennisPlayerSearchModal from "../modals/TennisPlayerSearchModal";
import TennisRemoveConfirmModal from "../modals/TennisRemoveConfirmModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NextMatch {
  match_date: string;
  opponent_name: string | null;
  round: string | null;
  tennis_tournaments?: { name: string; surface: string | null } | null;
}

export interface PlayerHero {
  player: {
    id: string;
    name: string;
    country: string | null;
    photo_url: string | null;
  };
  rank: number | null;
  isMainPlayer: boolean;
  nextMatch: NextMatch | null;
}

interface NewPlayer {
  id: string;
  name: string;
  country: string | null;
  photo_url: string | null;
}

interface TennisHeroSwiperProps {
  playerHeroes: PlayerHero[];
  userId: string;
  favoritePlayerIds: string[];
}

const SLIDE_DURATION = 7000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === tomorrow.toDateString()) return "Demain";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ─── Progress Bars ────────────────────────────────────────────────────────────

function ProgressBars({
  total,
  activeIndex,
  paused,
  onDotClick,
}: {
  total: number;
  activeIndex: number;
  paused: boolean;
  onDotClick: (i: number) => void;
}) {
  return (
    <div className="absolute bottom-3 left-4 right-4 z-10 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20 cursor-pointer"
        >
          {i < activeIndex ? (
            <div className="h-full w-full bg-amber-400/80" />
          ) : i === activeIndex ? (
            <div
              className="h-full bg-amber-400 rounded-full origin-left"
              style={{
                animation: paused
                  ? "none"
                  : `progress-fill ${SLIDE_DURATION}ms linear forwards`,
              }}
            />
          ) : (
            <div className="h-full w-0" />
          )}
        </button>
      ))}
      <style>{`@keyframes progress-fill { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

// ─── Empty Hero ───────────────────────────────────────────────────────────────

function EmptyHero({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative h-72 md:h-60 rounded-2xl overflow-hidden border border-white/10">
      <div className="absolute inset-0 bg-zinc-900" />
      <Image
        src="/tennis-court4.jpg"
        alt="Tennis court"
        fill
        priority
        className="object-cover opacity-30"
        quality={75}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute top-4 left-4 z-10">
        <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
          Favorite players
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm text-white font-semibold text-sm cursor-pointer"
        >
          <Plus size={16} />
          Add a player
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TennisHeroSwiper({
  playerHeroes,
  userId,
  favoritePlayerIds,
}: TennisHeroSwiperProps) {
  const router = useRouter();
  const supabase = createClient();
  const swiperRef = useRef<SwiperType | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removePlayer, setRemovePlayer] = useState<PlayerHero["player"] | null>(
    null,
  );

  // ✅ Trier par rank (meilleur rank en premier, puis sans rank à la fin)
  const sortedHeroes = [...playerHeroes].sort((a, b) => {
    if (a.rank === null && b.rank === null) return 0;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });

  const [localHeroes, setLocalHeroes] = useState<PlayerHero[]>(sortedHeroes);
  const [localFavIds, setLocalFavIds] = useState<string[]>(favoritePlayerIds);
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

  const handleSlideChange = (swiper: SwiperType) =>
    setActiveIndex(swiper.realIndex);
  const handleDotClick = (i: number) => swiperRef.current?.slideToLoop(i);

  // ── Ajouter un joueur ──────────────────────────────────────────────────────
  const handlePlayerAdded = (newPlayer?: NewPlayer) => {
    if (newPlayer) {
      setLocalHeroes((prev) => [
        ...prev,
        {
          player: {
            id: newPlayer.id,
            name: newPlayer.name,
            country: newPlayer.country,
            photo_url: newPlayer.photo_url,
          },
          rank: null,
          isMainPlayer: false,
          nextMatch: null,
        },
      ]);
      setLocalFavIds((prev) => [...prev, newPlayer.id]);
    }
    router.refresh();
  };

  // ── Supprimer un joueur ────────────────────────────────────────────────────
  const handleRemoveConfirm = async (playerId: string) => {
    try {
      await supabase
        .schema("sport")
        .from("user_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("entity_type", "tennis_player")
        .eq("entity_id", playerId);

      setLocalHeroes((prev) => prev.filter((h) => h.player.id !== playerId));
      setLocalFavIds((prev) => prev.filter((id) => id !== playerId));
      setRemovePlayer(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  if (!localHeroes.length) {
    return (
      <>
        <EmptyHero onAdd={() => setAddModalOpen(true)} />
        <TennisPlayerSearchModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          userId={userId}
          currentFavoriteIds={localFavIds}
          onPlayerAdded={(p) => {
            setAddModalOpen(false);
            handlePlayerAdded(p);
          }}
        />
      </>
    );
  }

  return (
    <>
      <div
        className="relative h-72 md:h-60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10"
        onMouseEnter={() => {
          setPaused(true);
          swiperRef.current?.autoplay.pause();
        }}
        onMouseLeave={() => {
          setPaused(false);
          swiperRef.current?.autoplay.resume();
          setHoveredPlayerId(null);
        }}
      >
        {/* label joueurs favoris */}
        <div className="absolute top-4 left-4 z-10">
          <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
            Favorite players
          </span>
        </div>

        {/* bouton ajouter */}
        <div className="absolute top-3 right-4 z-10">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddModalOpen(true)}
            className="bg-black/40 border-white/15 text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white hover:border-white/30 text-xs gap-1.5"
          >
            <Plus size={12} />
            Add a player
          </Button>
        </div>

        <Swiper
          modules={[Autoplay, EffectFade]}
          slidesPerView={1}
          autoplay={{ delay: SLIDE_DURATION, disableOnInteraction: false }}
          loop
          effect="fade"
          fadeEffect={{ crossFade: true }}
          speed={900}
          className="h-full w-full"
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          onSlideChange={handleSlideChange}
        >
          {localHeroes.map(({ player, rank, isMainPlayer, nextMatch }) => (
            <SwiperSlide key={player.id} className="relative">
              <div className="absolute inset-0 bg-zinc-900" />
              <Image
                src="/tennis-court4.jpg"
                alt="Tennis court"
                fill
                priority
                className="object-cover opacity-50"
                quality={75}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-r from-black/50 via-transparent to-transparent" />

              <div className="relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-between h-full p-4 md:p-8 gap-6 md:gap-4 pt-10 md:pt-8">
                {/* joueur avec bouton suppression au hover */}
                <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                  <div
                    className="relative group/photo"
                    onMouseEnter={() => setHoveredPlayerId(player.id)}
                    onMouseLeave={() => setHoveredPlayerId(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.15,
                        duration: 0.45,
                        ease: "easeOut",
                      }}
                      className="relative w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full overflow-hidden border-2 border-amber-400/50 shadow-xl"
                    >
                      {player.photo_url ? (
                        <Image
                          src={player.photo_url}
                          alt={player.name}
                          fill
                          className="object-cover object-top"
                          sizes="96px"
                          priority
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-end bg-linear-to-b from-zinc-700 to-zinc-800 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-zinc-500 mb-1 shrink-0" />
                          <div className="w-14 h-8 rounded-t-full bg-zinc-500 shrink-0" />
                        </div>
                      )}
                    </motion.div>

                    {/* bouton suppression au hover de la photo */}
                    <AnimatePresence>
                      {hoveredPlayerId === player.id && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setRemovePlayer(player)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-zinc-950 flex items-center justify-center shadow-lg z-10"
                        >
                          <X size={9} className="text-white" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    {isMainPlayer && (
                      <motion.span
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.35 }}
                        className="text-xs font-bold text-amber-300 tracking-widest"
                      >
                        MAIN PLAYER
                      </motion.span>
                    )}
                    <motion.h2
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.35 }}
                      className="text-2xl md:text-4xl font-extrabold tracking-tight text-white"
                    >
                      {player.name}
                    </motion.h2>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.35 }}
                      className="flex items-center gap-3 mt-1 justify-center md:justify-start"
                    >
                      {player.country && (
                        <span className="text-zinc-400 text-sm">
                          {player.country}
                        </span>
                      )}
                      {rank && (
                        <div className="flex items-center gap-1 bg-amber-400/15 border border-amber-400/30 rounded-full px-2.5 py-0.5">
                          <Trophy size={11} className="text-amber-400" />
                          <span className="text-amber-400 text-xs font-black">
                            #{rank} ATP
                          </span>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* prochain match */}
                {nextMatch ? (
                  <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    className="flex flex-col items-center md:items-end text-center md:text-right gap-1.5"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Next match
                    </p>
                    <p className="text-base md:text-lg font-bold text-white">
                      vs {nextMatch.opponent_name ?? "TBD"}
                    </p>
                    {/* {nextMatch.round && (
                      <p className="text-xs text-zinc-500">{nextMatch.round}</p>
                    )} */}
                    <div className="flex items-center justify-between gap-7">
                      {nextMatch.tennis_tournaments?.name && (
                        <p className="text-xs text-zinc-400">
                          {nextMatch.tennis_tournaments.name}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                        <Calendar size={11} className="text-amber-400" />
                        <span>{formatDate(nextMatch.match_date)}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-zinc-500 text-sm flex items-center gap-2"
                  >
                    <Calendar size={14} />
                    No upcoming matches
                  </motion.div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {localHeroes.length > 1 && (
          <ProgressBars
            key={activeIndex}
            total={localHeroes.length}
            activeIndex={activeIndex}
            paused={paused}
            onDotClick={handleDotClick}
          />
        )}
      </div>

      {/* Modals */}
      <TennisPlayerSearchModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        userId={userId}
        currentFavoriteIds={localFavIds}
        onPlayerAdded={(p) => {
          setAddModalOpen(false);
          handlePlayerAdded(p);
        }}
      />

      <TennisRemoveConfirmModal
        open={!!removePlayer}
        player={removePlayer}
        onClose={() => setRemovePlayer(null)}
        onConfirm={handleRemoveConfirm}
      />
    </>
  );
}
