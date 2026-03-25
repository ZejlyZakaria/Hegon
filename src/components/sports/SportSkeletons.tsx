// components/sports/SportSkeletons.tsx

function Pulse({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`rounded-lg bg-zinc-800 ${className}`} style={style} />
  );
}

function PulseRoundedFull({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`rounded-full bg-zinc-800 ${className}`} style={style} />
  );
}
// ─── Hero skeleton ────────────────────────────────────────────────────────────

export function FootballHeroSkeleton() {
  return (
    <div className="relative h-72 md:h-60 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/60 animate-pulse">
      <div className="absolute inset-0 flex flex-col md:flex-row items-center justify-center md:justify-between h-full p-4 md:p-8 gap-6 md:gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <PulseRoundedFull className="w-16 h-16 md:w-24 md:h-24 rounded-full shrink-0" />
          <div className="flex flex-col items-center md:items-start gap-2">
            <Pulse className="w-20 h-3" />
            <Pulse className="w-44 h-7" />
            <Pulse className="w-16 h-3" />
          </div>
        </div>
        <div className="flex flex-col items-center md:items-end gap-3">
          <div className="flex items-center gap-3 justify-end">
            <div className="flex flex-col items-end gap-2">
              <Pulse className="w-36 h-4" />
              <Pulse className="w-54 h-4" />
            </div>
            <Pulse className="w-12 h-12" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Pulse className="w-20 h-4" />
            <Pulse className="w-20 h-4" />
          </div>
        </div>
      </div>
      {/* progress bars */}
      <div className="absolute bottom-3 left-4 right-4 flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

// ─── Recent results skeleton ──────────────────────────────────────────────────

export function FootballRecentResultsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* tabs + forme */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pulse className="h-9 w-32 rounded-xl" />
          <Pulse className="h-9 w-28 rounded-xl" />
        </div>
        <div className="flex items-center gap-1.5">
          <Pulse className="w-10 h-2.5" />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Pulse key={i} className="w-5 h-5 rounded-sm" />
            ))}
          </div>
        </div>
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4 flex flex-col gap-4"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pulse className="w-6 h-6 rounded-sm" />
                <Pulse className="w-20 h-2.5" />
              </div>
              <Pulse className="w-8 h-5 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex flex-col items-center gap-2">
                <Pulse className="w-11 h-11 rounded-full" />
                <Pulse className="w-16 h-2.5" />
              </div>
              <div className="shrink-0 flex flex-col items-center gap-1 min-w-13">
                <Pulse className="w-14 h-7" />
                <Pulse className="w-8 h-2" />
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <Pulse className="w-11 h-11 rounded-full" />
                <Pulse className="w-16 h-2.5" />
              </div>
            </div>
            <div className="border-t border-zinc-800/60 pt-3 flex justify-center">
              <Pulse className="w-24 h-2.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Upcoming matches skeleton ────────────────────────────────────────────────

export function FootballUpcomingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* tabs */}
      <div className="flex items-center gap-2">
        <Pulse className="h-9 w-32 rounded-xl" />
        <Pulse className="h-9 w-28 rounded-xl" />
        <Pulse className="h-9 w-36 rounded-xl" />
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4 flex flex-col gap-4"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pulse className="w-6 h-6 rounded-sm" />
                <Pulse className="w-20 h-2.5" />
              </div>
              <Pulse className="w-10 h-5 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex flex-col items-center gap-2">
                <Pulse className="w-11 h-11 rounded-full" />
                <Pulse className="w-16 h-2.5" />
              </div>
              <div className="shrink-0 flex flex-col items-center gap-1.5">
                <Pulse className="w-12 h-2.5" />
                <Pulse className="w-8 h-2" />
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <Pulse className="w-11 h-11 rounded-full" />
                <Pulse className="w-16 h-2.5" />
              </div>
            </div>
            <div className="border-t border-zinc-800/60 pt-3 flex justify-center gap-2">
              <Pulse className="w-16 h-2.5" />
              <Pulse className="w-1 h-1 rounded-full mt-1" />
              <Pulse className="w-10 h-2.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Standings skeleton ───────────────────────────────────────────────────────

export function FootballStandingsSkeleton() {
  return (
    <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden animate-pulse">
      {/* tabs */}
      <div className="flex items-center gap-1 p-3 border-b border-zinc-800/60">
        <Pulse className="h-8 w-28 rounded-xl" />
        <Pulse className="h-8 w-24 rounded-xl" />
        <Pulse className="h-8 w-32 rounded-xl" />
      </div>

      {/* header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/60">
        <Pulse className="w-6 h-2.5" />
        <Pulse className="flex-1 h-2.5" />
        <div className="flex gap-5 mr-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Pulse key={i} className="w-5 h-2.5" />
          ))}
        </div>
      </div>

      {/* rows */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <Pulse className="w-1 h-4 rounded-full shrink-0" />
          <Pulse className="w-4 h-3" />
          <Pulse className="w-5 h-5 rounded-full shrink-0" />
          <Pulse
            className="flex-1 h-3"
            style={{ maxWidth: `${70 - i * 5}%` }}
          />
          <div className="flex gap-5 ml-auto">
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <Pulse key={j} className="w-5 h-3" />
            ))}
          </div>
        </div>
      ))}

      {/* legend */}
      <div className="px-4 py-3 border-t border-zinc-800/50 flex gap-4">
        {[60, 80, 72].map((w, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Pulse className="w-1 h-3 rounded-full" />
            <div
              className="h-2.5 rounded-lg bg-zinc-800"
              style={{ width: w }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BestXI skeleton ──────────────────────────────────────────────────────────

export function FootballBestXISkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full animate-pulse">
      <div className="flex-1 lg:w-2/3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Pulse className="h-9 w-24 rounded-xl" />
          <Pulse className="h-4 w-10" />
          <Pulse className="h-9 w-28 rounded-xl" />
        </div>
        <div
          className="relative w-full rounded-2xl bg-zinc-800/60"
          style={{ paddingBottom: "72%" }}
        >
          <div className="absolute inset-0 flex flex-col justify-around py-6 px-4">
            {[1, 4, 3, 1].map((count, row) => (
              <div key={row} className="flex justify-around">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Pulse className="w-12 h-12 rounded-full" />
                    <Pulse className="w-10 h-2" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:w-1/3">
        <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-4 flex flex-col gap-5">
          <Pulse className="h-4 w-28" />
          <div className="grid grid-cols-4 gap-y-4 gap-x-2 place-items-center">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Pulse className="w-10 h-10 rounded-full" />
                <Pulse className="w-8 h-2" />
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2">
            <Pulse className="h-16 rounded-xl" />
            <Pulse className="h-16 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tennis Hero skeleton ──────────────────────────────────────────────────────
export function TennisHeroSkeleton() {
  return (
    <div className="relative h-72 md:h-60 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/60 animate-pulse">
      <div className="absolute inset-0 flex flex-col md:flex-row items-center justify-center md:justify-between h-full p-4 md:p-8 gap-6 md:gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <PulseRoundedFull className="w-16 h-16 md:w-24 md:h-24 rounded-full shrink-0" />
          <div className="flex flex-col items-center md:items-start gap-2">
            <Pulse className="w-20 h-3" />
            <Pulse className="w-44 h-7" />
            <Pulse className="w-16 h-3" />
          </div>
        </div>
        <div className="flex flex-col items-center md:items-end gap-3">
          <Pulse className="w-40 h-4" />
          <Pulse className="w-36 h-6" />
          <div className="flex items-center justify-between gap-3">
            <Pulse className="w-20 h-4" />
            <Pulse className="w-20 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tennis Recent Results skeleton ───────────────────────────────────────────

export function TennisRecentResultsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center gap-2">
        <Pulse className="h-9 w-32 rounded-xl" />
        <Pulse className="h-9 w-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4 flex flex-col gap-4"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <div className="flex items-center justify-between">
              <Pulse className="w-20 h-2.5" />
              <Pulse className="w-8 h-5 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex flex-col items-center gap-2">
                <Pulse className="w-11 h-11 rounded-full" />
                <Pulse className="w-16 h-2.5" />
              </div>
              <Pulse className="w-14 h-7" />
              <div className="flex-1 flex flex-col items-center gap-2">
                <Pulse className="w-11 h-11 rounded-full" />
                <Pulse className="w-16 h-2.5" />
              </div>
            </div>
            <Pulse className="w-24 h-2.5 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

//─── Tennis Rankings skeleton ──────────────────────────────────────────────────

export function TennisRankingsSkeleton() {
  return (
    <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/60">
        <Pulse className="w-6 h-2.5" />
        <Pulse className="flex-1 h-2.5" />
        <div className="flex gap-5">
          {[0, 1, 2].map((i) => (
            <Pulse key={i} className="w-12 h-2.5" />
          ))}
        </div>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <Pulse className="w-4 h-3" />
          <Pulse className="w-8 h-8 rounded-full shrink-0" />
          <Pulse className="flex-1 h-3" />
          <Pulse className="w-12 h-3" />
        </div>
      ))}
    </div>
  );
}

// ─── Tennis Upcoming Tournaments skeleton ─────────────────────────────────────

export function TennisUpcomingSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {/* Sous-titre + pagination */}
      <div className="flex items-center justify-between gap-3">
        <Pulse className="w-64 h-3" />
        <div className="flex items-center gap-1.5">
          <Pulse className="w-8 h-8 rounded-full" />
          <Pulse className="w-6 h-3" />
          <Pulse className="w-8 h-8 rounded-full" />
        </div>
      </div>

      {/* Grille: 1 tournoi + 2 joueurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Tournoi card (à gauche) */}
        <div className="relative overflow-hidden rounded-xl border border-zinc-800/60 flex">
          {/* Terrain à gauche */}
          <div
            className="relative shrink-0 bg-zinc-800/60"
            style={{ width: "42%" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <Pulse className="w-24 h-32 opacity-30" />
            </div>
          </div>
          {/* Infos à droite */}
          <div className="relative z-20 flex flex-col justify-between p-4 flex-1 bg-zinc-950">
            <div className="flex flex-col gap-1.5">
              <Pulse className="w-16 h-4 rounded-full" />
            </div>
            <Pulse className="w-full h-5" />
            <div className="flex flex-col gap-0.5">
              <Pulse className="w-3/4 h-3" />
              <Pulse className="w-1/2 h-2.5" />
            </div>
          </div>
        </div>

        {/* Player card 1 */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4 flex flex-col gap-4">
          {/* Header: rank + round */}
          <div className="flex items-center justify-between">
            <Pulse className="w-12 h-4 rounded-full" />
            <Pulse className="w-16 h-3" />
          </div>

          {/* Joueur vs Adversaire */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col items-center gap-2">
              <Pulse className="w-11 h-11 rounded-full" />
              <Pulse className="w-16 h-3" />
            </div>

            <div className="shrink-0 flex flex-col items-center gap-1">
              <Pulse className="w-12 h-7 rounded-lg" />
            </div>

            <div className="flex-1 flex flex-col items-center gap-2">
              <Pulse className="w-11 h-11 rounded-full" />
              <Pulse className="w-16 h-3" />
            </div>
          </div>

          {/* Date */}
          <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-center gap-2">
            <Pulse className="w-3 h-3" />
            <Pulse className="w-28 h-3" />
          </div>
        </div>

        {/* Player card 2 */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4 flex flex-col gap-4">
          {/* Header: rank + round */}
          <div className="flex items-center justify-between">
            <Pulse className="w-12 h-4 rounded-full" />
            <Pulse className="w-20 h-3" />
          </div>

          {/* Joueur vs Adversaire */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col items-center gap-2">
              <Pulse className="w-11 h-11 rounded-full" />
              <Pulse className="w-20 h-3" />
            </div>

            <div className="shrink-0 flex flex-col items-center gap-1">
              <Pulse className="w-12 h-7 rounded-lg" />
            </div>

            <div className="flex-1 flex flex-col items-center gap-2">
              <Pulse className="w-11 h-11 rounded-full" />
              <Pulse className="w-14 h-3" />
            </div>
          </div>

          {/* Date */}
          <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-center gap-2">
            <Pulse className="w-3 h-3" />
            <Pulse className="w-32 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== F1 SKELETONS ==========

export function F1HeroSkeleton() {
  return (
    <div className="relative h-72 md:h-60 bg-zinc-900 rounded-2xl overflow-hidden animate-pulse border border-white/10">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-linear-to-br from-zinc-800 to-zinc-900" />

      {/* Label top-left */}
      <div className="absolute top-4 left-4 z-10">
        <div className="h-3 w-24 bg-zinc-800 rounded" />
      </div>

      {/* Content skeleton - Layout gauche/droite comme Hero */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-between h-full p-4 md:p-8 gap-6 md:gap-4 pt-10 md:pt-8">
        {/* GAUCHE - Circuit + Info */}
        <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
          {/* Circle icon */}
          <div className="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full bg-zinc-800" />

          <div className="space-y-2">
            {/* Badge */}
            <div className="h-3 w-32 bg-zinc-800 rounded mx-auto md:mx-0" />

            {/* Title */}
            <div className="h-8 w-64 bg-zinc-800 rounded-lg" />

            {/* Subtitle */}
            <div className="h-4 w-48 bg-zinc-800 rounded mx-auto md:mx-0" />
          </div>
        </div>

        {/* DROITE - Countdown + Dates */}
        <div className="flex flex-col items-center md:items-end gap-3">
          {/* Countdown */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center space-y-1">
                <div className="h-8 w-11 bg-zinc-800 rounded-lg" />
                <div className="h-2 w-6 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="space-y-1.5">
            <div className="h-3 w-56 bg-zinc-800 rounded" />
            <div className="h-3 w-48 bg-zinc-800 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function F1CalendarSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 bg-zinc-800 rounded-full" />
        <div className="h-4 w-32 bg-zinc-800 rounded" />
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {/* Grid 3 colonnes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-5 sm:p-6"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/25 to-transparent" />

            <div className="relative z-10 flex flex-col gap-4">
              {/* SECTION 1: Nom GP + Date */}
              <div className="flex flex-col gap-2">
                <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                <div className="flex items-center gap-3">
                  <div className="h-3 w-32 bg-zinc-800 rounded" />
                  <div className="h-3 w-20 bg-zinc-800 rounded" />
                </div>
              </div>

              {/* SECTION 2: Circuit Name + SVG */}
              <div className="flex items-center justify-between gap-2 min-h-30 sm:min-h-35">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 w-10 bg-zinc-800 rounded" />
                  <div className="h-5 w-32 bg-zinc-800 rounded" />
                  <div className="h-3 w-24 bg-zinc-800 rounded" />
                </div>
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-zinc-800 rounded" />
              </div>

              {/* SECTION 3: Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 min-h-12">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex flex-col gap-1">
                    <div className="h-2 w-10 bg-zinc-800 rounded" />
                    <div className="h-4 w-8 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function F1RecentResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 bg-zinc-800 rounded-full" />
        <div className="h-4 w-32 bg-zinc-800 rounded" />
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {/* Grid 3 colonnes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-5 sm:p-6"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-zinc-700/25 to-transparent" />

            {/* Badge Round skeleton */}
            <div className="absolute top-3 right-3 z-20">
              <div className="h-7 w-10 bg-zinc-800 rounded-t-md" />
            </div>

            <div className="relative z-10 flex flex-col gap-4">
              {/* SECTION 1: Header */}
              <div className="flex flex-col gap-2">
                <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                <div className="h-3 w-32 bg-zinc-800 rounded" />
              </div>

              {/* SECTION 2: Podium + Circuit */}
              <div className="flex items-center justify-between gap-2 min-h-30 sm:min-h-35">
                {/* Podium skeleton */}
                <div className="flex-1 flex flex-col gap-1.5">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="h-3 w-6 bg-zinc-800 rounded" />
                      <div className="h-3 w-24 bg-zinc-800 rounded" />
                    </div>
                  ))}
                </div>

                {/* Circuit SVG skeleton */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-zinc-800 rounded" />
              </div>

              {/* SECTION 3: Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 min-h-12">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex flex-col gap-1">
                    <div className="h-2 w-10 bg-zinc-800 rounded" />
                    <div className="h-4 w-8 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function F1DriversStandingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 bg-zinc-800 rounded-full" />
        <div className="h-4 w-40 bg-zinc-800 rounded" />
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {/* Table container */}
      <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="border-b border-zinc-800/60 px-4 py-2.5">
          <div className="flex items-center gap-4">
            <div className="h-3 w-6 bg-zinc-800 rounded" />
            <div className="h-3 w-20 bg-zinc-800 rounded" />
            <div className="h-3 w-24 bg-zinc-800 rounded flex-1" />
            <div className="h-3 w-8 bg-zinc-800 rounded hidden sm:block" />
            <div className="h-3 w-8 bg-zinc-800 rounded hidden md:block" />
            <div className="h-3 w-10 bg-zinc-800 rounded" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-zinc-800/50">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              {/* Position */}
              <div className="flex items-center gap-2 w-12">
                <div className="h-4 w-1 bg-zinc-800 rounded-full" />
                <div className="h-3 w-4 bg-zinc-800 rounded" />
              </div>

              {/* Driver name */}
              <div className="h-3 w-32 bg-zinc-800 rounded" />

              {/* Team */}
              <div className="flex items-center gap-2 flex-1">
                <div className="h-5 w-5 bg-zinc-800 rounded" />
                <div className="h-3 w-20 bg-zinc-800 rounded" />
              </div>

              {/* Wins */}
              <div className="h-3 w-6 bg-zinc-800 rounded hidden sm:block" />

              {/* Podiums */}
              <div className="h-3 w-6 bg-zinc-800 rounded hidden md:block" />

              {/* Points */}
              <div className="h-4 w-10 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-zinc-800/50 flex gap-5">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-1 bg-zinc-800 rounded-full" />
            <div className="h-2 w-16 bg-zinc-800 rounded" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-1 bg-zinc-800 rounded-full" />
            <div className="h-2 w-16 bg-zinc-800 rounded" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-1 bg-zinc-800 rounded-full" />
            <div className="h-2 w-20 bg-zinc-800 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function F1ConstructorsStandingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1 w-12 rounded-full bg-zinc-800" />
        <div className="h-3 w-48 rounded bg-zinc-800" />
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/30">
        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
                <tr>
                  <th className="pl-4 pr-3 py-3 text-left">
                    <div className="h-2 w-4 rounded bg-zinc-800" />
                  </th>
                  <th className="px-2 py-3 text-left">
                    <div className="h-2 w-16 rounded bg-zinc-800" />
                  </th>
                  <th className="hidden md:table-cell px-2 py-3 text-center">
                    <div className="h-2 w-10 rounded bg-zinc-800 mx-auto" />
                  </th>
                  <th className="hidden lg:table-cell px-2 py-3 text-center">
                    <div className="h-2 w-14 rounded bg-zinc-800 mx-auto" />
                  </th>
                  <th className="pr-4 pl-2 py-3 text-right">
                    <div className="h-2 w-12 rounded bg-zinc-800 ml-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    {/* Position */}
                    <td className="pl-4 pr-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-zinc-800" />
                        <div className="h-3 w-4 rounded bg-zinc-800" />
                      </div>
                    </td>

                    {/* Team Name + Logo */}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded bg-zinc-800" />
                        <div className="h-3 w-24 rounded bg-zinc-800" />
                      </div>
                    </td>

                    {/* Wins */}
                    <td className="hidden md:table-cell px-2 py-3">
                      <div className="h-3 w-6 rounded bg-zinc-800 mx-auto" />
                    </td>

                    {/* Podiums */}
                    <td className="hidden lg:table-cell px-2 py-3">
                      <div className="h-3 w-6 rounded bg-zinc-800 mx-auto" />
                    </td>

                    {/* Points */}
                    <td className="pr-4 pl-2 py-3">
                      <div className="h-3 w-12 rounded bg-zinc-800 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend Footer */}
        <div className="border-t border-zinc-800/50 bg-zinc-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3 rounded-full bg-zinc-800" />
              <div className="h-2 w-16 rounded bg-zinc-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3 rounded-full bg-zinc-800" />
              <div className="h-2 w-12 rounded bg-zinc-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3 rounded-full bg-zinc-800" />
              <div className="h-2 w-10 rounded bg-zinc-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
