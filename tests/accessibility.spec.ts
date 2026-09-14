import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of ["/", "/experiences", "/vip", "/stories", "/faq", "/contact", "/admin/login"]) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]);
    const structural = await builder.disableRules(["color-contrast"]).analyze();
    const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).exclude("header").analyze();
    expect([...structural.violations, ...contrast.violations].filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  });
}
