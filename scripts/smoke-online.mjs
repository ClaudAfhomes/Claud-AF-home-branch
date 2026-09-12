import { chromium } from "playwright";

const rawBaseUrl = process.argv[2] ?? process.env.ONLINE_BASE_URL;

if (!rawBaseUrl) {
  console.error("Usage: npm run test:online -- https://your-deployment.example");
  process.exit(2);
}

const baseUrl = new URL(rawBaseUrl);
if (!['http:', 'https:'].includes(baseUrl.protocol)) {
  console.error("The deployment URL must use HTTP or HTTPS.");
  process.exit(2);
}
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const routes = [
  "/",
  "/contact",
  "/stories",
  "/afhomes-admin",
  "/admin/reset-password",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const supabaseResponses = [];

page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes(".supabase.co/")) {
    supabaseResponses.push({
      status: response.status(),
      path: new URL(response.url()).pathname,
    });
  }
});

const checks = [];
const failures = [];

try {
  for (const route of routes) {
    const response = await page.goto(new URL(route, baseUrl).href, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const status = response?.status() ?? 0;
    checks.push({ check: `Route ${route}`, status, result: status === 200 ? "pass" : "fail" });
    if (status !== 200) failures.push(`${route} returned HTTP ${status}`);
  }

  const robots = await page.request.get(new URL("/robots.txt", baseUrl).href);
  const robotsText = await robots.text();
  const robotsPassed = robots.status() === 200 && robotsText.includes("User-agent:");
  checks.push({ check: "robots.txt", status: robots.status(), result: robotsPassed ? "pass" : "fail" });
  if (!robotsPassed) failures.push("robots.txt is missing or invalid");

  const sitemap = await page.request.get(new URL("/sitemap.xml", baseUrl).href);
  const sitemapText = await sitemap.text();
  const sitemapPassed = sitemap.status() === 200 && sitemapText.includes("<urlset");
  checks.push({ check: "sitemap.xml", status: sitemap.status(), result: sitemapPassed ? "pass" : "fail" });
  if (!sitemapPassed) failures.push("sitemap.xml is missing or invalid");

  const indexResponse = await page.request.get(baseUrl.href);
  const indexHtml = await indexResponse.text();
  const mainAsset = indexHtml.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i)?.[1];
  if (!mainAsset) {
    failures.push("Could not locate the deployed Vite entry bundle");
  } else {
    const mainBundle = await page.request.get(new URL(mainAsset, baseUrl).href);
    const mainText = await mainBundle.text();
    const adminAsset = mainText.match(/Admin-[A-Za-z0-9_-]+\.js/)?.[0];
    if (!adminAsset) {
      failures.push("Could not locate the deployed admin bundle");
    } else {
      const adminBundle = await page.request.get(new URL(`/assets/${adminAsset}`, baseUrl).href);
      const adminText = await adminBundle.text();
      const historyPassed = adminBundle.status() === 200
        && adminText.includes("Change History / Restore")
        && adminText.includes("Previous value")
        && adminText.includes("New value");
      checks.push({
        check: "Detailed history UI bundle",
        status: adminBundle.status(),
        result: historyPassed ? "pass" : "fail",
      });
      if (!historyPassed) failures.push("The deployed admin bundle does not contain the detailed history UI");
    }
  }

  const failedSupabaseResponses = supabaseResponses.filter(({ status }) => status >= 400);
  checks.push({
    check: "Supabase browser requests",
    status: `${supabaseResponses.length} checked`,
    result: failedSupabaseResponses.length === 0 ? "pass" : "fail",
  });
  for (const response of failedSupabaseResponses) {
    failures.push(`Supabase ${response.path} returned HTTP ${response.status}`);
  }

  checks.push({
    check: "Browser runtime errors",
    status: `${pageErrors.length} found`,
    result: pageErrors.length === 0 ? "pass" : "fail",
  });
  failures.push(...pageErrors.map((message) => `Browser error: ${message}`));

  console.table(checks);
  if (failures.length > 0) {
    throw new Error(`Online smoke test failed:\n- ${failures.join("\n- ")}`);
  }

  console.log(`Online smoke test passed: ${baseUrl.href}`);
} finally {
  await browser.close();
}
