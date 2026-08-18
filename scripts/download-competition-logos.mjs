// Downloads competition logo SVGs from football-logos.cc into public/football/competitions/.
// One-off / re-runnable: each competition page carries data-category-id / data-logo-id /
// data-svg-hash on its download button; the SVG lives at
//   https://images.football-logos.cc/{categoryId}/{logoId}.{svgHash}.svg
// The image host gates on Sec-Fetch-* headers, so those are required.
//
// Run:  node scripts/download-competition-logos.mjs   (needs network)
//
// These are competition trademarks, used here to brand the trophy cabinet in a personal app — same
// footing as the club crests already served. Re-run to refresh hashes if a logo 404s later.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "football", "competitions");

const PAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};
const SVG_HEADERS = {
  ...PAGE_HEADERS,
  Referer: "https://football-logos.cc/",
  Accept: "image/svg+xml,image/*,*/*",
  "Sec-Fetch-Dest": "image",
  "Sec-Fetch-Mode": "no-cors",
  "Sec-Fetch-Site": "cross-site",
};

// Competition pages to pull. Slugs verified against the live site.
const PAGES = [
  // Continental & world
  "/tournaments/uefa-champions-league/",
  "/tournaments/uefa-europa-league/",
  "/tournaments/uefa-conference-league/",
  "/tournaments/uefa-super-cup/",
  "/tournaments/fifa-club-world-cup/",
  "/tournaments/fifa-intercontinental-cup/",
  "/tournaments/conmebol-libertadores/",
  "/tournaments/conmebol-copa-sudamericana/",
  "/tournaments/caf-champions-league/",
  "/tournaments/afc-champions-league-elite/",
  "/tournaments/concacaf-champions-cup/",
  // Domestic leagues
  "/spain/la-liga/",
  "/england/english-premier-league/",
  "/germany/bundesliga/",
  "/italy/serie-a/",
  "/france/ligue-1/",
  "/netherlands/eredivisie/",
  "/portugal/primeira-liga/",
  // Domestic cups
  "/spain/copa-del-rey/",
  "/england/emirates-fa-cup/",
  "/england/efl-cup/",
  "/germany/dfb-pokal/",
  "/italy/coppa-italia/",
  "/france/french-cup/",
  "/portugal/taca-de-portugal/",
  "/netherlands/knvb-cup/",
  // Super cups
  "/spain/supercopa-de-espana/",
  "/england/fa-community-shield/",
  "/germany/franz-beckenbauer-supercup/",
  "/italy/italian-super-cup/",
];

const attr = (html, name) => html.match(new RegExp(`data-${name}="([^"]+)"`))?.[1];

async function run() {
  await mkdir(OUT, { recursive: true });
  const ok = [];
  const fail = [];
  for (const path of PAGES) {
    await new Promise((r) => setTimeout(r, 350)); // the image host rate-limits bursts → pace it
    try {
      const page = await fetch("https://football-logos.cc" + path, { headers: PAGE_HEADERS });
      if (!page.ok) { fail.push(`${path} (page ${page.status})`); continue; }
      const html = await page.text();
      const cat = attr(html, "category-id");
      const id = attr(html, "logo-id");
      const hash = attr(html, "svg-hash");
      if (!cat || !id || !hash) { fail.push(`${path} (no download data)`); continue; }
      // Prefer the SVG; many cups have no SVG uploaded (404) → fall back to the 1500px transparent
      // PNG whose exact hashed URL is already on the page (guessing the hash is hopeless).
      const svgUrl = `https://images.football-logos.cc/${cat}/${id}.${hash}.svg`;
      const res = await fetch(svgUrl, { headers: SVG_HEADERS });
      if (res.ok) {
        const svg = await res.text();
        if (svg.includes("<svg")) {
          await writeFile(join(OUT, `${id}.svg`), svg, "utf8");
          ok.push(`${id}.svg (${(svg.length / 1024).toFixed(1)}kb)`);
          continue;
        }
      }
      const pngUrl = html.match(new RegExp(`https://assets\\.football-logos\\.cc/logos/${cat}/1500x1500/${id}\\.[a-f0-9]+\\.png`))?.[0]
        ?? html.match(new RegExp(`https://assets\\.football-logos\\.cc/logos/${cat}/\\d+x\\d+/${id}\\.[a-f0-9]+\\.png`))?.[0];
      if (!pngUrl) { fail.push(`${path} (svg ${res.status}, no png on page)`); continue; }
      const png = await fetch(pngUrl, { headers: SVG_HEADERS });
      if (!png.ok) { fail.push(`${path} (png ${png.status})`); continue; }
      const buf = Buffer.from(await png.arrayBuffer());
      await writeFile(join(OUT, `${id}.png`), buf);
      ok.push(`${id}.png (${(buf.length / 1024).toFixed(1)}kb, svg fallback)`);
    } catch (e) {
      fail.push(`${path} (${e.message})`);
    }
  }
  console.log(`\n✓ Downloaded ${ok.length}:`);
  ok.forEach((s) => console.log("  " + s));
  if (fail.length) {
    console.log(`\n✗ Failed ${fail.length}:`);
    fail.forEach((s) => console.log("  " + s));
  }
}

run();
