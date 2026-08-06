import { chromium } from "playwright";
const dir = "C:/Users/ADMIN/AppData/Local/Temp/claude/c--Users-ADMIN-Desktop-MyDocuments-digital-second-brain/0b48b5b4-03d7-4623-8cfb-6fea49869295/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 2 });
await page.goto(`file:///${dir}/glow-preview.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/glow-preview2.png` });
await browser.close();
console.log("done");
