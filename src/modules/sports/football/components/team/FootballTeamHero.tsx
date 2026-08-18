"use client";

// The team hero — a mirror of Watching's MediaHero (cinematic backdrop, bottom-anchored identity,
// pitch + facts), so a team fiche reads like a film fiche. The backdrop is the club's fanart from
// TheSportsDB; when a club has none, it falls back to the banner, then to a blurred crest so the
// hero is NEVER an empty rectangle. The About text is the "pitch"; the facts (country, founded,
// stadium, capacity, site) are the meta row.

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, Images } from "lucide-react";
import { HeroDescription } from "@/modules/watching/components/detail/HeroDescription";
import { displayCompetitionName } from "../../service";
import type { FootballTeamFull } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

// TheSportsDB ships Wikipedia's lead paragraph verbatim, brackets and all — and its pronunciation
// guides often arrive EMPTY: "Deportivo Alavés, S.A.D. (Spanish pronunciation: ; Sporting Alavés)".
// A dangling colon reads as a bug in our page, and an IPA string would be noise here anyway, so the
// whole parenthetical goes. Citation marks and the empty brackets they leave behind go with it.
function cleanDescription(text: string): string {
  return text
    .replace(/\s*\([^)]*pronunciation[^)]*\)/gi, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s*\(\s*[;,:]*\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function FormDot({ r }: { r: "W" | "D" | "L" }) {
  const map = { W: "bg-accent-sports text-accent-sports-deep", D: "bg-white/25 text-white/90", L: "bg-red-500/80 text-white" } as const;
  return <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${map[r]}`}>{r}</span>;
}

interface Props {
  team: FootballTeamFull;
  standing: { position: number; competition_name: string } | null;
  form: ("W" | "D" | "L")[];
  onBack: () => void;
  /** Open the backdrop picker (mirrors Watching's onOpenImages). */
  onOpenImages?: () => void;
  /** The Follow / Following control — rendered by the page (it owns the favorites data). */
  action?: ReactNode;
}

export function FootballTeamHero({ team, standing, form, onBack, onOpenImages, action }: Props) {
  const bg = team.fanart_url || team.banner_url || null;
  const pitch = team.description ? cleanDescription(team.description) : null;
  const website = team.website
    ? team.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    : null;
  const websiteHref = team.website
    ? team.website.startsWith("http") ? team.website : `https://${team.website}`
    : null;

  // RANK AND FORM BELONG TOGETHER, ABOVE THE NAME. The form dots used to sit at the tail of the meta
  // row, right after the website — one lone green circle that read as a stray badge attached to a
  // URL. Beside the standing they have a subject: here is where the club sits, and here is how it
  // has been getting on.
  const eyebrow = standing || form.length > 0 ? (
    <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {standing && (
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-accent-sports">{ordinal(standing.position)}</span>
          <span className="text-caption uppercase tracking-wide text-white/45">in {displayCompetitionName(standing.competition_name)}</span>
        </span>
      )}
      {form.length > 0 && <span className="flex items-center gap-1">{form.map((r, i) => <FormDot key={i} r={r} />)}</span>}
    </div>
  ) : null;

  const metaRow = (
    <>
      {team.country && <span>{team.country}</span>}
      {team.founded && (<><span className="text-white/20">·</span><span>Est. {team.founded}</span></>)}
      {team.venue && (<><span className="text-white/20">·</span><span>{team.venue}</span></>)}
      {team.stadium_capacity && (<><span className="text-white/20">·</span><span>{team.stadium_capacity.toLocaleString("en-GB")} seats</span></>)}
      {website && websiteHref && (
        <>
          <span className="text-white/20">·</span>
          <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="text-white/60 underline-offset-2 transition-colors hover:text-white hover:underline">{website}</a>
        </>
      )}
    </>
  );

  const backdrop = bg ? (
    <Image src={bg} alt="" fill priority className="object-cover" style={{ objectPosition: "center 25%" }} sizes="100vw" />
  ) : (
    // No fanart/banner → the crest itself, blurred to a coloured canvas. Never an empty rectangle.
    <div
      className="absolute inset-0"
      style={{ backgroundImage: `url(${team.crest_url || CREST_FALLBACK})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(90px) saturate(200%) brightness(0.45)", transform: "scale(1.4)" }}
    />
  );

  return (
    <>
      {/* ── Mobile: stacked cinematic hero ── */}
      <div className="lg:hidden">
        <div className="relative aspect-video w-full overflow-hidden">
          {backdrop}
          <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/30 to-transparent" />
          <button type="button" onClick={onBack} className="on-artwork absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label text-white/80">
            <ArrowLeft size={14} />
            Back
          </button>
          {onOpenImages && (
            <button type="button" onClick={onOpenImages} aria-label="Change backdrop" className="on-artwork absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/80">
              <Images size={15} />
            </button>
          )}
        </div>

        <div className="relative -mt-14 flex flex-col items-center px-4 pb-2 text-center">
          <div className="relative h-24 w-24 shrink-0 drop-shadow-xl">
            <Image src={team.crest_url || CREST_FALLBACK} alt={team.name} fill sizes="96px" className="object-contain" />
          </div>
          <div className="mt-3">{eyebrow}</div>
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-white">{team.name}</h1>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/45">{metaRow}</div>
          {pitch && <HeroDescription text={pitch} />}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>

      {/* ── Desktop: wide cinematic banner ── */}
      <div className="relative hidden w-full overflow-hidden lg:block" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 280 }}>
        {backdrop}
        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-surface-0/50 to-surface-0" />
        <div className="absolute inset-0 bg-linear-to-r from-surface-0/80 via-surface-0/20 to-transparent" />

        <button type="button" onClick={onBack} className="on-artwork group absolute left-10 top-5 z-20 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-label text-white/70 transition-colors hover:text-white">
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        {onOpenImages && (
          <button type="button" onClick={onOpenImages} aria-label="Change backdrop" className="on-artwork absolute right-10 top-5 z-20 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-label text-white/70 transition-colors hover:text-white">
            <Images size={14} />
            Artwork
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 px-10 pb-8">
          <div className="flex items-end gap-6">
            <div className="relative h-28 w-28 shrink-0 drop-shadow-2xl">
              <Image src={team.crest_url || CREST_FALLBACK} alt={team.name} fill priority sizes="112px" className="object-contain" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              {eyebrow}
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white">{team.name}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">{metaRow}</div>
              {pitch && <HeroDescription text={pitch} />}
              {action && <div className="mt-4">{action}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
