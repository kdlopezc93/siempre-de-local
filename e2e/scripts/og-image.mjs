// Dibuja apps/web/og/og-image.html en Chromium y la guarda en apps/web/public/og-image.png: la
// vista previa de los links en WhatsApp (2026-11-06). `pnpm --filter @sdl/e2e og-image`.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const web = (p) => fileURLToPath(new URL(`../../apps/web/${p}`, import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${web('og/og-image.html')}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: web('public/og-image.png') });
await browser.close();
