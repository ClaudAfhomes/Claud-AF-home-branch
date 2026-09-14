import { expect, test } from "@playwright/test";

const routes = ["/", "/experiences", "/vip", "/stories", "/faq", "/contact"];

for (const route of routes) {
  test(`${route} is usable without horizontal overflow`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("mobile navigation opens and reaches About", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open menu/i }).click();
  await expect(page.getByRole("navigation", { name: /mobile/i })).toBeVisible();
  await page.getByRole("navigation", { name: /mobile/i }).getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test("contact validation remains readable and focusable", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Please enter your name.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
});
