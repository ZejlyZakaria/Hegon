"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FootballMatchClient } from "@/modules/sports/football/components/match/FootballMatchClient";

// The full-page "escape hatch" for a match — the sliding panel is the primary surface; this route
// exists for a future rich fiche (lineups/events) and direct links.
export default function FootballMatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => router.back()}
        className="ml-4 mt-4 flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-secondary"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <FootballMatchClient externalId={Number(id)} />
    </div>
  );
}
