"use client";

import { WidgetStack } from "../WidgetStack";
import { SportCard, type SportEvent } from "./SportCard";

// STATIC events (UX prototype) — covers the hard case: multiple matches + mixed
// sports in one day. Scroll the stack to move between them. Real time-filtered
// feed = Sport V2.
const STATIC_EVENTS: SportEvent[] = [
  { sport: "football", home: "Arsenal", away: "Chelsea", homeColor: "#EF0107", awayColor: "#034694", comp: "Premier League", time: "14:00" },
  { sport: "football", home: "Real Madrid", away: "Barcelona", homeColor: "#d4af37", awayColor: "#A50044", comp: "LaLiga", time: "21:00" },
  { sport: "tennis", player: "Alcaraz", opponent: "Sinner", tournament: "Wimbledon", round: "Final", time: "15:00" },
  { sport: "f1", gp: "British GP", circuit: "Silverstone", country: "United Kingdom", session: "Race", time: "16:00" },
];

export function SportWidget() {
  const events = STATIC_EVENTS;

  if (events.length === 0) {
    return (
      <div className="glass-panel flex h-full w-full items-center justify-center rounded-[22px]">
        <p className="text-[11px] italic text-white/40">No sport this week.</p>
      </div>
    );
  }

  return (
    <WidgetStack>
      {events.map((e, i) => (
        <SportCard key={i} event={e} />
      ))}
    </WidgetStack>
  );
}
