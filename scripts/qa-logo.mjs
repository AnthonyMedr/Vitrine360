import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const sizes = [1920, 1366, 1024, 768, 430, 390];
const report = [];

for (const width of sizes) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  const data = await page.evaluate(() => {
    const header = document.querySelector("header");
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const horizontal = document.querySelector("header img[src*=horizontal]");
    const symbol = document.querySelector("header img[src*=symbol]");
    return {
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      headerHeight: Math.round(header?.getBoundingClientRect().height || 0),
      horizontal: !!horizontal && horizontal.getBoundingClientRect().width > 0,
      symbol: !!symbol && symbol.getBoundingClientRect().width > 0,
      search: visible("header form"),
      desktopMenu: visible("header nav"),
      compactMenu: visible("header button[aria-label*=menu i]"),
      cart: visible("header a[aria-label*=Carrinho]")
    };
  });
  await page.screenshot({ path: `C:/Temp/gamel-logo-qa/header-${width}.png` });
  report.push(data);
  await page.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
