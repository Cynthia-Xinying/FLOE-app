/**
 * 在终端打印浏览器控制台错误（无需手动打开 DevTools）
 * 用法：先 npm run serve:dist 或 npm run dev，再 node scripts/capture-console.mjs [url]
 */
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4173/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") {
    console.log(`[browser ${t}]`, msg.text());
  }
});

page.on("pageerror", (err) => {
  console.log("[pageerror]", err.message);
  if (err.stack) console.log(err.stack);
});

page.on("requestfailed", (req) => {
  console.log("[requestfailed]", req.url(), req.failure()?.errorText);
});

const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
console.log("[http]", res?.status(), url);

let inner = "";
try {
  inner = await page.$eval("#root", (el) => el.innerHTML);
} catch {
  inner = "";
}
console.log("[#root innerHTML length]", inner.length);
if (inner.length < 50) {
  console.log("[#root preview]", inner.slice(0, 200));
}

await browser.close();
