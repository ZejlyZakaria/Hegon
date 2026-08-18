"use client";

// The Team PAGE (route: /perso/sports/football/team/[externalId]). Deep stats derived from the team's
// stored matches (zero extra API), enriched with the OFFICIAL current position (football_standings)
// and HONOURS (football_competition_winners, matched by Wikidata QID). Layers: the World (match stats +
// honours) + You (Fan Log record).

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, Check, Plus, Loader2, Trophy, Target, Shield, ShieldCheck, TrendingUp, Gauge, Ban, Flame } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { FeatureMatchCard } from "../matches/UpcomingMatchCard";
import { FootballTeamHero } from "./FootballTeamHero";
import { TeamArtworkGallery } from "./TeamArtworkGallery";
import { FOOTBALL_KEYS } from "../../hooks/query-keys";
import { useTeam, useTeamMatches, useTeamHonours, useTeamStanding } from "../../hooks/useFootballTeamPage";
import { useFootballTeams, useFollowTeam, useUnfollowTeam } from "../../hooks/useFootballTeams";
import { useTeamPersonalStats } from "../../hooks/useTeamPersonalStats";
import { useUserPredictions } from "../../hooks/useFootballPrediction";
import { FootballMatchPanel } from "../match/FootballMatchPanel";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite, FootballTeamFull, TeamHonour } from "../../service";

const seasonLabel = (s: number) => `${s}/${s + 1}`;

// Curated brand look per competition — real logo + colour + short label. Honours come from Wikidata
// across ALL competitions (not just the ones we ingest), so the cabinet styles cups we never track
// otherwise. Logos live in /public/football/competitions (see scripts/download-competition-logos.mjs).
// Keyed by Wikidata's English label (+ historical aliases); unmatched → trophy icon + sport accent.
type CompStyle = { short: string; color: string; logo?: string };
const COMP_STYLE: Record<string, CompStyle> = {
  // Continental
  "UEFA Champions League": { short: "Champions League", color: "#2b3f8c", logo: "uefa-champions-league.png" },
  "European Cup": { short: "European Cup", color: "#2b3f8c", logo: "uefa-champions-league.png" },
  "UEFA Europa League": { short: "Europa League", color: "#ef6a1a", logo: "uefa-europa-league.png" },
  "UEFA Cup": { short: "UEFA Cup", color: "#ef6a1a", logo: "uefa-europa-league.png" },
  "UEFA Europa Conference League": { short: "Conference League", color: "#1a8a5a", logo: "uefa-conference-league.png" },
  "UEFA Conference League": { short: "Conference League", color: "#1a8a5a", logo: "uefa-conference-league.png" },
  "UEFA Super Cup": { short: "Super Cup", color: "#3b6fd4", logo: "uefa-super-cup.png" },
  "Copa Libertadores": { short: "Libertadores", color: "#d9a441", logo: "conmebol-libertadores.png" },
  "CONMEBOL Libertadores": { short: "Libertadores", color: "#d9a441", logo: "conmebol-libertadores.png" },
  "Copa Sudamericana": { short: "Sudamericana", color: "#c53a2f", logo: "conmebol-copa-sudamericana.png" },
  "CAF Champions League": { short: "CAF CL", color: "#1f8f4e", logo: "caf-champions-league.png" },
  "AFC Champions League": { short: "AFC CL", color: "#c8102e", logo: "afc-champions-league-elite.png" },
  "AFC Champions League Elite": { short: "AFC CL Elite", color: "#c8102e", logo: "afc-champions-league-elite.png" },
  "CONCACAF Champions Cup": { short: "CONCACAF", color: "#1c72c4", logo: "concacaf-champions-cup.png" },
  "CONCACAF Champions League": { short: "CONCACAF", color: "#1c72c4", logo: "concacaf-champions-cup.png" },
  // World
  "FIFA Club World Cup": { short: "Club World Cup", color: "#c9a227", logo: "fifa-club-world-cup.png" },
  "Intercontinental Cup": { short: "Intercontinental", color: "#bd972f", logo: "fifa-intercontinental-cup.png" },
  "FIFA Intercontinental Cup": { short: "Intercontinental", color: "#bd972f", logo: "fifa-intercontinental-cup.png" },
  // Leagues
  "La Liga": { short: "La Liga", color: "#e4002b", logo: "la-liga.png" },
  "Campeonato Nacional de Liga de Primera División": { short: "La Liga", color: "#e4002b", logo: "la-liga.png" },
  "Premier League": { short: "Premier League", color: "#8b2d8f", logo: "english-premier-league.png" },
  "Football League First Division": { short: "First Division", color: "#8b2d8f", logo: "english-premier-league.png" },
  Bundesliga: { short: "Bundesliga", color: "#d20515", logo: "bundesliga.png" },
  "Serie A": { short: "Serie A", color: "#1c72c4", logo: "serie-a.png" },
  "Ligue 1": { short: "Ligue 1", color: "#2b3a5e", logo: "ligue-1.png" },
  Eredivisie: { short: "Eredivisie", color: "#e5620e", logo: "eredivisie.png" },
  "Primeira Liga": { short: "Primeira Liga", color: "#0b7a3b", logo: "primeira-liga.png" },
  // Domestic cups
  "Copa del Rey": { short: "Copa del Rey", color: "#b3123a", logo: "copa-del-rey.png" },
  "FA Cup": { short: "FA Cup", color: "#c8102e", logo: "emirates-fa-cup.png" },
  "EFL Cup": { short: "League Cup", color: "#1a5fb4", logo: "efl-cup.png" },
  "Football League Cup": { short: "League Cup", color: "#1a5fb4", logo: "efl-cup.png" },
  "DFB-Pokal": { short: "DFB-Pokal", color: "#d4021d", logo: "dfb-pokal.png" },
  "Coppa Italia": { short: "Coppa Italia", color: "#005bac", logo: "coppa-italia.png" },
  "Coupe de France": { short: "Coupe de France", color: "#243a72", logo: "french-cup.png" },
  "Taça de Portugal": { short: "Taça de Portugal", color: "#0b7a3b", logo: "taca-de-portugal.png" },
  "KNVB Cup": { short: "KNVB Cup", color: "#e5620e", logo: "knvb-cup.png" },
  // Super cups
  "Supercopa de España": { short: "Supercopa", color: "#c69214", logo: "supercopa-de-espana.png" },
  "FA Community Shield": { short: "Community Shield", color: "#b01e28", logo: "fa-community-shield.png" },
  "FA Charity Shield": { short: "Charity Shield", color: "#b01e28", logo: "fa-community-shield.png" },
  "DFL-Supercup": { short: "DFL-Supercup", color: "#d20515", logo: "franz-beckenbauer-supercup.png" },
  "Supercoppa Italiana": { short: "Supercoppa", color: "#bd972f", logo: "italian-super-cup.png" },
  "Trophée des Champions": { short: "Trophée des Champions", color: "#2b3a5e" },
};
const ACCENT_FALLBACK = "#B6FF2E";
function compStyle(name: string): CompStyle {
  return COMP_STYLE[name] ?? { short: displayCompetitionName(name), color: ACCENT_FALLBACK };
}

// Trophy cabinet grouped by prestige. `category` already rides on every honour (from the enrich
// whitelist), so the grouping is pure data — no per-competition bookkeeping here.
const TIER_ORDER: { key: string; label: string }[] = [
  { key: "world", label: "World" },
  { key: "continental", label: "Continental" },
  { key: "league", label: "League" },
  { key: "domestic_cup", label: "Domestic cups" },
  { key: "domestic_super", label: "Super cups" },
];

export default function FootballTeamPage({ externalId }: { externalId: string }) {
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: team } = useTeam(externalId);
  const { data: matches } = useTeamMatches(externalId);
  const { data: personal } = useTeamPersonalStats(userId, externalId);
  const { data: honours } = useTeamHonours(externalId);
  const { data: standing } = useTeamStanding(externalId);
  const { data: predictions } = useUserPredictions(userId);

  const seasons = useMemo(() => {
    const set = new Set<number>();
    for (const m of matches ?? []) if (m.season != null) set.add(m.season);
    return [...set].sort((a, b) => b - a);
  }, [matches]);

  const [season, setSeason] = useState<number | null>(null);
  const activeSeason = season ?? seasons[0] ?? null;
  const [artworkOpen, setArtworkOpen] = useState(false);

  const seasonMatches = useMemo(
    () => (matches ?? []).filter((m) => activeSeason == null || m.season === activeSeason),
    [matches, activeSeason],
  );
  const finished = seasonMatches.filter((m) => m.status === "FINISHED" && m.home_score != null && m.away_score != null);
  const upcoming = seasonMatches.filter((m) => m.status !== "FINISHED");
  const stats = useMemo(() => computeTeamStats(finished, externalId), [finished, externalId]);
  const records = useMemo(() => computeRecords(finished, externalId), [finished, externalId]);
  const form = finished.slice(-5).map((m) => resultFor(m, externalId));
  const nextMatch = upcoming[0] ?? null;
  const byComp = useMemo(() => computeByCompetition(finished, externalId), [finished, externalId]);
  const primaryStanding = standing?.[0] ?? null;
  // A win RATE needs a sample. Under this many matches the headline shows the raw W-D-L record.
  const ratedSample = stats.p >= 5;
  const hasPersonalRecord = (personal?.watchedCount ?? 0) > 0 || (personal?.stadiumCount ?? 0) > 0;

  // Enrich on open (fanart + About + full honours), then refresh — cached server-side, so this is a
  // no-op after the first visit.
  const qc = useQueryClient();
  useEffect(() => {
    if (!externalId) return;
    fetch(`/api/football/enrich-team/${externalId}`, { method: "POST", keepalive: true })
      .then(() => {
        qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.teamFull(externalId) });
        qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.teamHonours(externalId) });
      })
      .catch(() => {});
  }, [externalId, qc]);

  // The one dropdown primitive, not a hand-styled <select> — that inconsistency is exactly what
  // FilterSelect exists to kill.
  const seasonSelect = seasons.length > 0 ? (
    <FilterSelect
      value={String(activeSeason ?? "")}
      onChange={(v) => setSeason(Number(v))}
      options={seasons.map((y) => ({ value: String(y), label: seasonLabel(y) }))}
      size="sm"
      className="w-28"
      aria-label="Season"
    />
  ) : null;
  return (
    <div className="min-h-screen bg-surface-0">
      {/* ── Hero — cinematic, mirrors Watching's MediaHero (see FootballTeamHero) ── */}
      {team ? (
        <FootballTeamHero
          team={team}
          standing={primaryStanding}
          form={form}
          onBack={() => router.back()}
          onOpenImages={() => setArtworkOpen(true)}
          action={<FollowButton userId={userId} team={team} />}
        />
      ) : (
        <div className="w-full bg-surface-1" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 200 }} />
      )}

      {/* The trophy cabinet keeps the FULL width — it is a scrolling wall, and the one block on this
          page whose content genuinely wants every pixel. */}
      <div className="px-4 pt-6 sm:px-6">
        {honours && honours.length > 0 && <TrophyCabinet honours={honours} />}
      </div>

      {/* ── EVERYTHING BELOW USED TO BE A STACK OF FULL-WIDTH BANDS, and that — not the content — was
           what made the page feel empty. At 1400px it set "3:0", "+3" and "1" six hundred pixels
           apart, and left the next match as a crest at one end of the screen and a date at the other.
           Sparse content stretched to the viewport reads as a void however good each card is.
           So the page COMPOSES instead: the same main-column + right-rail grid the Watching fiche
           uses, every block sized to what it actually holds. ── */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 px-4 pb-6 sm:px-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          {/* ── Season — ONE block instead of five, split in two INSIDE the card: the verdict on the
               left, the detail on the right. A flat row of numbers across the full width was what
               scattered "3:0", "+3" and "1" hundreds of pixels apart; a column that owns its width
               reads as one thing. Each part still appears only once it has something to say. ── */}
          <section>
            <SectionHeader
              title={<><span className="font-normal text-text-tertiary">Season</span> {activeSeason ? seasonLabel(activeSeason) : ""}</>}
              subtitle={stats.p > 0 ? `${stats.p} ${stats.p === 1 ? "match" : "matches"} played` : undefined}
              actions={seasonSelect}
            />
            {stats.p === 0 ? (
              <p className="rounded-card bg-surface-1 py-6 text-center text-sm text-text-tertiary">No matches played yet this season.</p>
            ) : (
              <div className="rounded-card bg-surface-1 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-6">
                  {/* THE VERDICT. "100%" off a single match was the loudest thing on the page and the
                      least true — a number pretending to be a trend. Win rate earns the big type only
                      once the sample can carry it; under that the W-D-L record, a plain fact, takes
                      the slot. */}
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-text-tertiary">{ratedSample ? "Win rate" : "Record"}</p>
                    {ratedSample ? (
                      <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-accent-sports">{stats.winPct}%</p>
                    ) : (
                      <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-text-primary">
                        {stats.w}<span className="text-text-tertiary">-</span>{stats.d}<span className="text-text-tertiary">-</span>{stats.l}
                      </p>
                    )}
                    <div className="mt-3"><WDLBar w={stats.w} d={stats.d} l={stats.l} /></div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span><b className="tabular-nums text-accent-sports">{stats.w}</b> <span className="text-text-tertiary">W</span></span>
                      <span><b className="tabular-nums text-text-primary">{stats.d}</b> <span className="text-text-tertiary">D</span></span>
                      <span><b className="tabular-nums text-red-400">{stats.l}</b> <span className="text-text-tertiary">L</span></span>
                    </div>

                    {/* A SPLIT NEEDS TWO SIDES. All-home-so-far is the record again with an empty
                        card beside it. */}
                    {stats.home.p > 0 && stats.away.p > 0 && (
                      <div className="mt-4 rounded-lg border border-border-subtle p-3">
                        <p className="mb-2.5 text-[10px] uppercase tracking-wide text-text-tertiary">Home &amp; away form</p>
                        <div className="flex flex-col gap-2">
                          <SplitRow label="Home" s={stats.home} />
                          <SplitRow label="Away" s={stats.away} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* THE DETAIL. Icons are not decoration here: eight label/value pairs in a row are a
                      wall of digits, and the mark is what lets the eye land on the one it wants.
                      (Possession is deliberately absent — football-data's free tier ships scores, not
                      match stats, so that tile could only ever be empty.) */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:border-l lg:border-border-subtle lg:pl-6 xl:grid-cols-3">
                    <MiniStat icon={Target} label="Goals for" value={stats.gf} />
                    <MiniStat icon={Shield} label="Goals against" value={stats.ga} />
                    <MiniStat icon={TrendingUp} label="Goal difference" value={stats.gd > 0 ? `+${stats.gd}` : stats.gd} accent={stats.gd > 0} />
                    <MiniStat icon={Gauge} label="Goals / game" value={records.goalsPerGame ?? "—"} />
                    <MiniStat icon={ShieldCheck} label="Clean sheets" value={stats.cs} />
                    <MiniStat icon={Ban} label="Failed to score" value={stats.fts} />
                    {records.biggestWin && <MiniStat icon={Trophy} label="Biggest win" value={records.biggestWin} />}
                    {records.streak && <MiniStat icon={Flame} label="Current streak" value={records.streak} accent={records.streak.includes("win")} />}
                  </div>
                </div>

                {/* WITH ONE COMPETITION THIS REPEATED THE SEASON TOTALS VERBATIM — header, card and
                    all. A breakdown of one thing is not a breakdown. */}
                {byComp.length > 1 && (
                  <div className="mt-5 flex flex-col gap-2 border-t border-border-subtle pt-4">
                    {byComp.map((c) => (
                      <div key={c.name} className="flex items-center gap-3">
                        {c.emblem && (
                          <span className="relative h-5 w-5 shrink-0"><Image src={c.emblem} alt="" fill sizes="20px" className="object-contain" /></span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{displayCompetitionName(c.name)}</span>
                        <span className="hidden w-20 shrink-0 sm:block"><WDLBar w={c.w} d={c.d} l={c.l} /></span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-text-secondary">{c.w}W {c.d}D {c.l}L</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right rail — the two things that are about a MOMENT rather than about a season. */}
        <div className="min-w-0 space-y-6">
          {/* ── Next match — THE SAME CARD the main page shows, not a bespoke bar. A fixture is an
               object with two clubs, a competition, a countdown and a place; rendering it as a crest,
               a name and a far-away date threw all of that away and looked broken besides. ── */}
          <section>
            <SectionHeader title="Next match" />
            {nextMatch ? (
              <FeatureMatchCard
                m={nextMatch}
                focusExt={externalId}
                pick={predictions?.[nextMatch.external_match_id] ?? null}
              />
            ) : (
              <p className="rounded-card bg-surface-1 py-6 text-center text-sm text-text-tertiary">No upcoming match.</p>
            )}
          </section>

          {/* ── Your record — it is YOURS, so it only exists once you have one. Printing "0 · 0 · —"
               spent a whole section saying nothing. ── */}
          {hasPersonalRecord && (
            <section>
              <SectionHeader title="Your record" />
              <div className="rounded-card bg-surface-1 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <Stat value={personal?.watchedCount ?? 0} label="Watched" />
                  <Stat value={personal?.stadiumCount ?? 0} label="At stadium" />
                  <Stat value={personal?.avgRating != null ? personal.avgRating.toFixed(1) : "—"} label="Avg rating" />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <SlidingPanel open={artworkOpen} onClose={() => setArtworkOpen(false)} title="Artwork" width="gallery">
        <div className="p-5">
          <TeamArtworkGallery externalId={externalId} />
        </div>
      </SlidingPanel>

      <FootballMatchPanel />
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────────────

// Follow / Following toggle (1st axis — user_favorites). Main team = a non-clickable badge.
function FollowButton({ userId, team }: { userId: string | null; team: FootballTeamFull }) {
  const { data: teams } = useFootballTeams(userId);
  const follow = useFollowTeam(userId);
  const unfollow = useUnfollowTeam(userId);

  const isMain = teams?.mainTeamId != null && team.id === teams.mainTeamId;
  const isFollowing = (teams?.allFavoriteTeamIds ?? []).includes(team.id);
  const pending = follow.isPending || unfollow.isPending;

  if (isMain) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent-sports/15 px-3 text-xs font-semibold text-accent-sports">
        <Star size={13} className="fill-accent-sports" />
        Main team
      </span>
    );
  }

  const onClick = () => {
    if (pending || !userId) return;
    if (isFollowing) unfollow.mutate(team.id);
    else follow.mutate({ teamId: team.id, apiExternalId: team.api_external_id });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending || !userId}
      className={`group inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
        isFollowing
          ? "bg-surface-2 text-text-secondary hover:bg-red-500/15 hover:text-red-400"
          : "bg-accent-sports text-accent-sports-deep hover:bg-accent-sports/90"
      }`}
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isFollowing ? (
        <Check size={13} className="group-hover:hidden" />
      ) : (
        <Plus size={13} />
      )}
      <span>{isFollowing ? <><span className="group-hover:hidden">Following</span><span className="hidden group-hover:inline">Unfollow</span></> : "Follow"}</span>
    </button>
  );
}

// The flat wall (Option B): one horizontal row of trophy plates, sorted by prestige (tier) then by
// count. ~6 fit on desktop; the rest scroll. Arrows live in the header, wheel/drag works too.
function TrophyCabinet({ honours }: { honours: TeamHonour[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rank = new Map(TIER_ORDER.map((t, i) => [t.key, i]));
  const sorted = useMemo(
    () => [...honours].sort((a, b) => {
      const ra = rank.get(a.category ?? "") ?? 99;
      const rb = rank.get(b.category ?? "") ?? 99;
      return ra - rb || b.titles - a.titles;
    }),
    // rank is a stable derivation of a module-level constant
    [honours], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });

  return (
    <section className="mb-6">
      <SectionHeader
        title="Trophy cabinet"
        subtitle="Every title, all competitions"
        actions={sorted.length > 6 ? <CarouselNav onPrev={() => scroll(-1)} onNext={() => scroll(1)} /> : undefined}
      />
      <div ref={scrollRef} className="-mx-4 flex gap-2.5 overflow-x-auto scroll-px-4 px-4 scrollbar-hide sm:mx-0 sm:scroll-px-0 sm:px-0">
        {sorted.map((h) => <TrophyCard key={h.competition_name} h={h} />)}
      </div>
    </section>
  );
}

// One competition's trophies — a branded plate. Depth from the SURFACE + a colour tint (a gradient is
// the sanctioned way to brand a card; a decorative hairline is not), never from chrome.
function TrophyCard({ h }: { h: TeamHonour }) {
  const { short, color, logo } = compStyle(h.competition_name);
  return (
    <div className="relative shrink-0 basis-[46%] overflow-hidden rounded-card border border-border-subtle bg-surface-1 p-3.5 sm:basis-[calc((100%-1.875rem)/4)] lg:basis-[calc((100%-3.125rem)/6)]">
      <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${color}30, ${color}0d 55%, transparent)` }} />
      <div className="relative">
        <div className="flex items-start justify-between">
          {/* Logo on its own frosted chip — a neutral, blurred surface so a logo reads the same
              whether it's dark or light, instead of fighting the coloured card behind it. */}
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/10 backdrop-blur-md">
            {logo ? (
              <Image src={`/football/competitions/${logo}`} alt="" width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
            ) : (
              <Trophy size={18} style={{ color }} />
            )}
          </span>
          <span className="text-2xl font-extrabold leading-none tabular-nums" style={{ color }}>{h.titles}</span>
        </div>
        <p className="mt-2.5 truncate text-sm font-semibold text-text-primary" title={displayCompetitionName(h.competition_name)}>{short}</p>
        <p className="text-[11px] text-text-tertiary">{h.titles === 1 ? "title" : "titles"}</p>
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-bold tabular-nums ${accent ? "text-accent-sports" : "text-text-primary"}`}>{value}</span>
      <span className="text-[10px] text-text-tertiary">{label}</span>
    </div>
  );
}

// The season's shape at a glance: wins / draws / losses as one proportional bar. The visual anchor
// reused by the season card, the home/away split and each competition row.
function WDLBar({ w, d, l }: { w: number; d: number; l: number }) {
  const total = w + d + l || 1;
  const seg = (n: number, cls: string) => (n > 0 ? <div className={cls} style={{ width: `${(n / total) * 100}%` }} /> : null);
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
      {seg(w, "bg-accent-sports")}
      {seg(d, "bg-white/25")}
      {seg(l, "bg-red-500/70")}
    </div>
  );
}

// One quiet label/value pair. The season's secondary facts are a GRID of small type, not six more
// carded surfaces — that inflation is what made this page mostly chrome.
function MiniStat({ icon: Icon, label, value, accent }: { icon: typeof Target; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon size={15} className="shrink-0 text-text-tertiary" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</p>
        <p className={`truncate text-sm font-semibold ${accent ? "text-accent-sports" : "text-text-primary"}`}>{value}</p>
      </div>
    </div>
  );
}

// Home / away as one LINE each, inside the season card — they used to be two half-empty cards.
function SplitRow({ label, s }: { label: string; s: { p: number; w: number; d: number; l: number } }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="min-w-0 flex-1"><WDLBar w={s.w} d={s.d} l={s.l} /></span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-text-secondary">{s.w}W {s.d}D {s.l}L</span>
    </div>
  );
}

// ─── Derivations ─────────────────────────────────────────────────────────────────

function resultFor(m: FootballMatchLite, ext: string): "W" | "D" | "L" {
  const isHome = m.home_external_id === ext;
  const gf = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
  const ga = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0);
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

function computeTeamStats(finished: FootballMatchLite[], ext: string) {
  const acc = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, fts: 0, home: { p: 0, w: 0, d: 0, l: 0 }, away: { p: 0, w: 0, d: 0, l: 0 } };
  for (const m of finished) {
    const isHome = m.home_external_id === ext;
    const gf = isHome ? m.home_score! : m.away_score!;
    const ga = isHome ? m.away_score! : m.home_score!;
    acc.p++; acc.gf += gf; acc.ga += ga;
    if (ga === 0) acc.cs++;
    if (gf === 0) acc.fts++;
    const res = gf > ga ? "w" : gf < ga ? "l" : "d";
    acc[res]++;
    const split = isHome ? acc.home : acc.away;
    split.p++; split[res]++;
  }
  return { ...acc, gd: acc.gf - acc.ga, winPct: acc.p ? Math.round((acc.w / acc.p) * 100) : 0 };
}

// A few match-derived highlights. Returned as NAMED fields, not a list: each one belongs in a
// different place in the season card, and a generic array forced them all into the same shape.
function computeRecords(finished: FootballMatchLite[], ext: string): { biggestWin: string | null; streak: string | null; goalsPerGame: string | null } {
  if (!finished.length) return { biggestWin: null, streak: null, goalsPerGame: null };

  // Biggest win (max goal margin among wins)
  let best: { margin: number; text: string } | null = null;
  for (const m of finished) {
    if (resultFor(m, ext) !== "W") continue;
    const isHome = m.home_external_id === ext;
    const gf = isHome ? m.home_score! : m.away_score!;
    const ga = isHome ? m.away_score! : m.home_score!;
    const opp = isHome ? m.away_name : m.home_name;
    if (!best || gf - ga > best.margin) best = { margin: gf - ga, text: `${gf}-${ga} v ${opp}` };
  }

  // Current streak (from the most recent match backwards) — only once it IS a streak.
  const seq = finished.map((m) => resultFor(m, ext));
  const last = seq[seq.length - 1];
  let n = 0;
  for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++;
  const streak = n >= 2 ? `${n} ${last === "W" ? "wins" : last === "L" ? "losses" : "draws"}` : null;

  const gf = finished.reduce((s, m) => s + (m.home_external_id === ext ? m.home_score! : m.away_score!), 0);

  return { biggestWin: best?.text ?? null, streak, goalsPerGame: (gf / finished.length).toFixed(2) };
}

function computeByCompetition(finished: FootballMatchLite[], ext: string) {
  const map = new Map<string, { name: string; emblem: string | null; p: number; w: number; d: number; l: number }>();
  for (const m of finished) {
    const name = m.competition_name ?? "Other";
    if (!map.has(name)) map.set(name, { name, emblem: m.emblem_url, p: 0, w: 0, d: 0, l: 0 });
    const c = map.get(name)!;
    c.p++;
    const r = resultFor(m, ext);
    if (r === "W") c.w++; else if (r === "D") c.d++; else c.l++;
  }
  return [...map.values()].sort((a, b) => b.p - a.p);
}
