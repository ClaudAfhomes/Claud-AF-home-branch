import { expect, test } from "@playwright/test";

test("public site and primary navigation render", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Something went wrong");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

const publicRoutes = [
  "/about",
  "/experiences",
  "/experiences/hotspring-ecofarm-resort",
  "/experiences/smart-wellness-hotel",
  "/experiences/alm-japanese-restaurant",
  "/vip",
  "/stories",
  "/faq",
  "/compliance",
  "/contact",
];

for (const route of publicRoutes) {
  test(`public route ${route} renders without layout errors`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "This page is taking a rest day.",
    );
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("logged-out visitors are redirected from the admin editor to sign in", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Admin email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("admin password can be shown and hidden", async ({ page }) => {
  await page.goto("/admin/login");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("sample-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("admin password recovery page remains available", async ({ page }) => {
  await page.goto("/admin/forgot-password");
  await expect(
    page.getByRole("heading", { name: /reset|password/i }),
  ).toBeVisible();
});

test("contact form validates required fields without submitting", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Please enter your name.")).toBeVisible();
  await expect(
    page.getByText("Please enter a valid email address."),
  ).toBeVisible();
  await expect(
    page.getByText("Please write a message of at least 10 characters."),
  ).toBeVisible();
});

test("unknown routes show the not-found page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "This page is taking a rest day." }),
  ).toBeVisible();
});

test("Supabase auth fallbacks never leave callback errors on the public homepage", async ({
  page,
}) => {
  await page.goto("/?error=invalid_request&error_code=flow_state_already_used");
  await expect(page).toHaveURL(/\/admin\/auth\/callback\?/);
  await expect(
    page.getByRole("heading", { name: "Verifying sign-in" }),
  ).toBeVisible();
});
