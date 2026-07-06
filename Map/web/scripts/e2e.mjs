// 헤드리스 E2E: 지도 렌더 → 지역 선택 → 프리셋 전환 → 랭킹 탭 → 다크모드. 스크린샷 + 콘솔 오류 수집.
import { chromium } from "playwright";

const BASE = process.env.E2E_URL ?? "http://localhost:4173/";
const OUT = process.env.E2E_OUT ?? "e2e-shots";
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1560, height: 950 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector(".map-container canvas", { timeout: 20000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/1-map-light.png` });

await page.fill(".search", "울산 남구");
await page.waitForSelector(".score-hero", { timeout: 10000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/2-region-ulsan.png` });

await page.click("button.preset:has-text('AI 훈련 캠퍼스')");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/3-preset-ai.png` });

await page.click("nav.tabs button:has-text('랭킹')");
await page.waitForSelector(".rank-table tbody tr", { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/4-ranking.png` });

const top5 = await page.$$eval(".rank-table tbody tr", (rows) =>
  rows.slice(0, 5).map((r) => {
    const c = r.querySelectorAll("td");
    return `${c[0].textContent}위 ${c[1].textContent} ${c[2].textContent} ${c[3].textContent}점`;
  }),
);
console.log("TOP5(AI 프리셋):", top5.join(" | "));

await page.emulateMedia({ colorScheme: "dark" });
await page.click("nav.tabs button:has-text('지도')");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/5-map-dark.png` });

await browser.close();

if (errors.length > 0) {
  console.error("콘솔/페이지 오류:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("E2E OK — 오류 0건, 스크린샷 5장");
