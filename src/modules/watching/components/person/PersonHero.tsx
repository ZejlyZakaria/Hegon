"use client";

import { Fragment } from "react";
import Image from "next/image";
import { ArrowLeft, User } from "lucide-react";
import type { PersonProfile } from "../../service";
import { HeroDescription } from "../detail/HeroDescription";

interface Props {
  profile: PersonProfile;
  roleLabel: string;
  backdrop: string | null;   // the signature title's backdrop (your top-rated, ideally)
  onBack: () => void;
}

// Mirror of MediaHero: the signature title's backdrop is the canvas, the person's
// portrait plays the poster (same glossy frame), name + role + origin sit inline, and
// the bio uses the shared HeroDescription — so a person page reads as the same product.
export function PersonHero({ profile, roleLabel, backdrop, onBack }: Props) {
  const born = profile.birthday ? new Date(profile.birthday).getFullYear() : null;
  const meta = [roleLabel, born ? `b. ${born}` : null, profile.place_of_birth].filter(Boolean) as string[];

  const metaRow = meta.map((m, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="text-white/20">·</span>}
      <span className={i === 0 ? "capitalize" : ""}>{m}</span>
    </Fragment>
  ));

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <div className="relative aspect-video w-full overflow-hidden">
          {backdrop ? (
            <Image src={backdrop} alt="" fill priority unoptimized className="object-cover" style={{ objectPosition: "center 25%" }} sizes="100vw" />
          ) : (
            <div className="h-full w-full bg-surface-1" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/30 to-transparent" />
          <button
            type="button"
            onClick={onBack}
            className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/80 backdrop-blur-sm"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>

        <div className="relative -mt-16 px-4 pb-2">
          <div className="flex items-end gap-4">
            <div className="relative aspect-2/3 w-(--poster-md) shrink-0 overflow-hidden rounded-tile border border-white/10 bg-surface-2 shadow-xl">
              {profile.profile_url ? (
                <Image src={profile.profile_url} alt={profile.name} fill unoptimized priority sizes="96px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><User className="text-text-tertiary" size={28} /></div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-balance text-xl font-bold leading-tight tracking-tight text-white line-clamp-3">{profile.name}</h1>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">{metaRow}</div>

          {profile.biography && <HeroDescription text={profile.biography} />}
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="relative hidden w-full overflow-hidden lg:block" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 280 }}>
        {backdrop ? (
          <Image src={backdrop} alt="" fill priority unoptimized className="object-cover" style={{ objectPosition: "center 27%" }} sizes="100vw" />
        ) : (
          <div className="h-full w-full bg-surface-1" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-surface-0/50 to-surface-0" />
        <div className="absolute inset-0 bg-linear-to-r from-surface-0/80 via-surface-0/20 to-transparent" />

        <button
          type="button"
          onClick={onBack}
          className="group absolute left-10 top-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3.5 py-2 text-[13px] font-medium text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/50 hover:text-white"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-10 pb-8">
          <div className="flex items-end gap-8">
            {/* Portrait — same glossy frame as the detail-page poster */}
            <div className="relative aspect-2/3 w-(--poster-xl) shrink-0 overflow-hidden rounded-card p-1">
              {profile.profile_url ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${profile.profile_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: "blur(6px) saturate(180%) brightness(1.2)",
                    }}
                  />
                  <div className="absolute inset-0 bg-white/15" />
                  <div className="relative h-full w-full overflow-hidden rounded-tile">
                    <Image src={profile.profile_url} alt={profile.name} fill unoptimized priority sizes="160px" className="object-cover" />
                  </div>
                </>
              ) : (
                <div className="relative h-full w-full overflow-hidden rounded-tile border border-white/10 bg-surface-2">
                  <div className="flex h-full w-full items-center justify-center"><User className="text-text-tertiary" size={40} /></div>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white">{profile.name}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">{metaRow}</div>
              {profile.biography && <HeroDescription text={profile.biography} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
