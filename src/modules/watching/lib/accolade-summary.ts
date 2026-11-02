import type { AwardCategory, AwardEntry } from "../types";

/** Keep the external overall totals distinct from the tracked ceremony/category subset. */
export function externalAwardSummary(raw: string | null | undefined) {
  const text=raw?.trim();
  if(!text || text==="N/A") return null;
  const wins=text.match(/(?:^|[^a-z])([0-9]+)\s+wins?\b/i);
  const nominations=text.match(/([0-9]+)\s+nominations?\b/i);
  const headline=text.match(/^(Won|Nominated for)\s+([0-9]+)\s+(Primetime Emmys?|Oscars?|BAFTA[^.]*|Golden Globes?)/i);
  return wins || nominations || headline ? {
    additional:/\bAnother\s+[0-9]+\s+wins?\b/i.test(text),
    wins:wins ? Number(wins[1]):null,
    nominations:nominations ? Number(nominations[1]):null,
    headline:headline ? {won:headline[1].toLowerCase()==="won",count:Number(headline[2]),name:headline[3].replace(/^Primetime /,"")}:null,
  }:null;
}

export function featuredAccolade(entries: AwardEntry[], categories: ReadonlyMap<string,AwardCategory>) {
  const wins=entries.filter(e=>e.won).sort((a,b)=>(categories.get(a.category)?.rank ?? 99)-(categories.get(b.category)?.rank ?? 99)||b.year-a.year||a.category.localeCompare(b.category));
  const first=wins[0];if(!first) return null;
  const label=categories.get(first.category)?.label;
  if(!label) return null;
  const matches=wins.filter(e=>e.category===first.category && e.ceremony===first.ceremony);
  const years=[...new Set(matches.map(e=>e.year))].sort((a,b)=>a-b);
  return {label,count:matches.length,years:years.slice(0,3).join(", ")+(years.length>3 ? ` +${years.length-3} years`:"")};
}
