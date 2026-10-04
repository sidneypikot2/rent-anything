// What this proves: the web app renders without script errors and the browser reaches
// the API through the same address and CORS setup a person's browser uses. It is a smoke
// test — one happy path through the parts everything else depends on, not feature
// coverage. Extend it as the core path grows (area page, add to cart, checkout).
import { test, expect } from "@playwright/test";

// Uncaught exceptions and console errors: a page that renders but logs errors is broken.
function collectErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
}

test("home page renders and reaches the API", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Moalboal");
  await expect(page.getByTestId("api-status")).toContainText("API ok");
  await expect(page.getByTestId("nav-signin")).toBeVisible();

  expect(errors).toEqual([]);
});

// The login pages and the admin entry point render with their own forms, and the UI kit
// page renders every component.
for (const [path, heading, testId] of [
  ["/login", null, "guest-signin"],
  ["/partner/login", "List with Rent-Anything", "partner-signin"],
  ["/admin", "Admin console", "admin-signin"],
  ["/admin/ui-kit", "Tidal Grove", "ui-kit"],
]) {
  test(`${path} renders`, async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);

    await page.goto(path);
    if (heading) await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await expect(page.getByTestId(testId)).toBeVisible();

    expect(errors).toEqual([]);
  });
}

// Sign-up through the real API, and the /partner guard: signed out goes to
// /partner/login, a guest is sent home, a partner gets the dashboard.
test("sign-up and the partner guard", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);
  const stamp = Date.now();

  const password = () => page.getByLabel("Password", { exact: true });
  const confirmation = () => page.getByLabel("Confirm password");

  async function signUp(path, name, email, { checkConfirmation = false } = {}) {
    await page.goto(path);
    await page.getByRole("button", { name: "Create one" }).click();
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Email").fill(email);
    await password().fill("password123");

    if (checkConfirmation) {
      // The two fields show and hide together.
      await page.getByRole("button", { name: "Show" }).first().click();
      await expect(password()).toHaveAttribute("type", "text");
      await expect(confirmation()).toHaveAttribute("type", "text");

      // A mismatch is caught before anything is sent.
      await confirmation().fill("password124");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByText("Passwords don't match")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }

    await confirmation().fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
  }

  // Signed out, both dashboards send you to their login.
  await page.goto("/partner");
  await expect(page).toHaveURL(/\/partner\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await signUp("/login", "Smoke Guest", `guest-${stamp}@example.com`, { checkConfirmation: true });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("guest-dashboard")).toBeVisible();
  await expect(page.getByTestId("nav-user")).toHaveText("Smoke Guest");

  // A guest on a partner page is sent to their own dashboard.
  await page.goto("/partner");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).not.toHaveURL(/\/partner/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByTestId("nav-signin")).toBeVisible();

  await signUp("/partner/login", "Smoke Partner", `partner-${stamp}@example.com`);
  await expect(page).toHaveURL(/\/partner\/dashboard$/);
  await expect(page.getByTestId("partner-dashboard")).toBeVisible();

  expect(errors).toEqual([]);
});
