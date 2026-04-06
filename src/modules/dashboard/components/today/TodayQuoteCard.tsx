import Image from "next/image";
import { quotesLibrary, type Quote } from "../../data/quotes";

// ─── Config ───────────────────────────────────────────────────────────────────

const MOOD_BG: Record<string, string> = {
  "spiritual-arabic": "/assets/quotes/spiritual-arabic.png",
  "spiritual-universal": "/assets/quotes/spiritual-universal.png",
  philosophical: "/assets/quotes/philosophical.png",
  poetic: "/assets/quotes/poetic.png",
  bold: "/assets/quotes/bold.png",
  minimal: "/assets/quotes/minimal.png",
};

const MOOD_LABEL: Record<string, string> = {
  spiritual: "Daily Reflection",
  philosophical: "Philosophy",
  poetic: "Poetry",
  bold: "Mindset",
  minimal: "Clarity",
};

const MOOD_ACCENT: Record<string, string> = {
  spiritual: "text-amber-300",
  philosophical: "text-stone-300",
  poetic: "text-rose-300",
  bold: "text-orange-400",
  minimal: "text-zinc-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDailyQuote(): Quote {
  const d = new Date();
  const block = Math.floor(d.getHours() / 6); // 4 blocks: 0-5h, 6-11h, 12-17h, 18-23h
  const seed =
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() * 10 + block;
  return quotesLibrary[seed % quotesLibrary.length];
}

function getBgKey(quote: Quote): string {
  if (quote.mood === "spiritual") {
    return quote.origin === "arabic" ? "spiritual-arabic" : "spiritual-universal";
  }
  return quote.mood;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayQuoteCard() {
  const quote = getDailyQuote();
  const bgSrc = MOOD_BG[getBgKey(quote)];
  const accentClass = MOOD_ACCENT[quote.mood];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 flex-1 flex flex-col min-h-30">
      <Image src={bgSrc} alt="" fill unoptimized className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/55 to-black/30" />

      <div className="relative flex flex-col flex-1 p-3 gap-1.5 justify-between">
        <span className={`self-start text-[10px] font-bold uppercase tracking-widest ${accentClass}`}>
          {MOOD_LABEL[quote.mood]}
        </span>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-white/90 leading-relaxed italic">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[11px] text-white/40">— {quote.source}</p>
        </div>
      </div>
    </div>
  );
}
