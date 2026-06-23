"use client";

// Curated writing prompts — kills the blank page. Three rotate per day.
const PROMPTS = [
  "What went well today?",
  "What are you grateful for right now?",
  "What's on your mind that you haven't said out loud?",
  "What did you learn today?",
  "What's one thing you want to remember about today?",
  "What drained you, and what gave you energy?",
  "If today had a title, what would it be?",
  "What are you looking forward to?",
  "What would make tomorrow feel like a win?",
  "Who or what are you thankful for today?",
];

// Structured starting points — insert a markdown skeleton to fill in.
const TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Gratitude",
    text: "Three things I'm grateful for today:\n\n1. \n2. \n3. \n",
  },
  {
    label: "Daily review",
    text: "## Today\n\n**Wins**\n\n\n**Challenges**\n\n\n**Tomorrow**\n\n",
  },
  {
    label: "Reflection",
    text: "**How I feel**\n\n\n**Why**\n\n\n**What I need**\n\n",
  },
];

const ACCENT = "var(--color-accent-journal-vivid)";

// Every seed text (prompts + templates) — used to keep the picker visible while
// the draft still equals an untouched seed (so you can re-pick), and hide it once
// you write your own.
export const JOURNAL_SEEDS = new Set<string>([...PROMPTS, ...TEMPLATES.map((t) => t.text)]);

export function JournalPrompts({ onPick }: { onPick: (text: string) => void }) {
  const seed = new Date().getDate();
  const picks = [0, 3, 6].map((o) => PROMPTS[(seed + o) % PROMPTS.length]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-text-tertiary">Need a spark?</p>
        <div className="flex flex-wrap gap-2">
          {picks.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              className="rounded-control bg-surface-2 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-tertiary">Templates</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onPick(t.text)}
            className="rounded-control border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-2"
            style={{
              color: ACCENT,
              borderColor: `color-mix(in srgb, ${ACCENT} 28%, transparent)`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
