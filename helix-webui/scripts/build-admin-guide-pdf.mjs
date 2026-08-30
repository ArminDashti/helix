#!/usr/bin/env node
/**
 * Build Persian admin guide PDF from docs/guide/fa/admin-guide.html
 * Requires: npm install && npx playwright install chromium
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "docs", "guide", "fa", "admin-guide.html");
const outDir = path.join(root, "public", "docs", "fa");
const outPdf = path.join(outDir, "helix-admin-guide.pdf");

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await page.pdf({
    path: outPdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await browser.close();
  console.log(`Wrote ${outPdf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
