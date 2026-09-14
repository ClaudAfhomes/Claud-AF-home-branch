import { expect, test } from "@playwright/test";

for (const route of ["/", "/experiences", "/vip", "/contact", "/admin/login"]) {
  test(`${route} matches its approved layout`, async ({ page }) => {
    await page.goto(route);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(750);
    const name = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled", mask: [page.locator("img"), page.locator("video")], maxDiffPixelRatio: 0.015, timeout: 15_000 });
  });
}
