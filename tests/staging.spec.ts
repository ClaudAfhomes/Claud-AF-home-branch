import { expect, test } from "@playwright/test";

const qaEmail = process.env.QA_ADMIN_EMAIL;
const qaPassword = process.env.QA_ADMIN_PASSWORD;
const allowWrites = process.env.QA_ALLOW_WRITES === "true";

test("staging administrator can sign in and open protected CMS areas", async ({ page }) => {
  test.skip(!qaEmail || !qaPassword, "Set dedicated QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD credentials.");
  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(qaEmail!);
  await page.getByLabel("Password", { exact: true }).fill(qaPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Inquiry Inbox" }).click();
  await expect(page.getByRole("heading", { name: "Inquiry inbox" })).toBeVisible();
});

test("staging inquiry submission reaches the configured backend", async ({ page }) => {
  test.skip(!allowWrites || !qaEmail || !qaPassword, "Enable writes and provide a dedicated staging administrator.");
  await page.goto("/contact");
  const suffix = Date.now();
  await page.getByLabel("Name").fill("AFhomes QA Automation");
  await page.getByLabel("Email").fill(`qa+${suffix}@example.com`);
  await page.getByLabel("Contact Number").fill("+639000000000");
  await page.getByLabel("Inquiry Type").selectOption("General Inquiry");
  await page.getByLabel("Message").fill(`Automated staging inquiry ${suffix}. Safe to delete.`);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Message sent\./)).toBeVisible();
  await expect(page.getByText(/Reference:/)).toBeVisible();

  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(qaEmail!);
  await page.getByLabel("Password", { exact: true }).fill(qaPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  await page.getByRole("button", { name: "Inquiry Inbox" }).click();
  const request = page.locator("article").filter({ hasText: `qa+${suffix}@example.com` });
  await expect(request).toBeVisible();
  await request.getByLabel("Progress").selectOption("contacted");
  await request.getByLabel("Internal notes").fill("Verified by the automated staging QA workflow.");
  await request.getByRole("button", { name: "Save changes" }).click();
  await expect(request.getByRole("button", { name: "Up to date" })).toBeVisible();
});
