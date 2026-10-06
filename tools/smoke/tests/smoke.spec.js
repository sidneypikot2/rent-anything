// What this proves: the web app renders without script errors, the server renders pages
// from the API, and the browser reaches the API through the same address and CORS setup a
// person's browser uses. It is a smoke
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find your next escape");
  await expect(page.getByTestId("nav-signin")).toBeVisible();
  await expect(page.getByTestId("nav-register")).toHaveAttribute("href", "/register");
  // Rendered on the server from the API (the sample destinations, RAA-33).
  await expect(page.getByTestId("destination-card").first()).toBeVisible();
  await expect(page.getByTestId("activity-card").first()).toBeVisible();

  expect(errors).toEqual([]);
});

// The search box asks the API from the browser (CORS and ports), then leads to a
// destination page rendered on the server.
test("search a landmark and open its destination", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);

  await page.goto("/");
  await page.getByTestId("search-input").fill("kota");
  const suggestions = page.getByTestId("search-suggestions");
  await expect(suggestions).toContainText("Kota Beach");
  await suggestions.getByRole("link", { name: /^Kota Beach/ }).click();

  await expect(page).toHaveURL(/\/bantayan-island#kota-beach$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bantayan Island");
  await expect(page.locator("#kota-beach")).toBeVisible();

  // Enter opens the full results page.
  await page.goto("/");
  await page.getByTestId("search-input").fill("snorkelling");
  await page.getByTestId("search-input").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=snorkelling$/);
  await expect(page.getByTestId("search-results")).toContainText("Bantayan Island");

  expect(errors).toEqual([]);
});

// The sign-in and sign-up pages and the admin entry point render with their own forms, and the UI kit
// page renders every component. On the guest's sign-in and sign-up pages the header's own
// Sign in / Create an account links are hidden: the card is that form.
for (const [path, heading, testId] of [
  ["/login", null, "guest-signin"],
  ["/register", null, "guest-signup"],
  ["/partner/login", "List with TripKoNext", "partner-signin"],
  ["/partner/register", "List with TripKoNext", "partner-signup"],
  ["/admin", "Admin console", "admin-signin"],
  ["/admin/ui-kit", "Tidal Grove", "ui-kit"],
]) {
  test(`${path} renders`, async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);

    await page.goto(path);
    if (heading) await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await expect(page.getByTestId(testId)).toBeVisible();
    if (path === "/login" || path === "/register") {
      await expect(page.getByTestId("nav-signin")).toHaveCount(0);
      await expect(page.getByTestId("nav-register")).toHaveCount(0);
    }

    expect(errors).toEqual([]);
  });
}

// Sign-up through the real API (email and password only), and the /partner guard: signed
// out goes to /partner/login, a guest is sent home, a partner gets the dashboard.
test("sign-up and the partner guard", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);
  const stamp = Date.now();

  const password = () => page.getByLabel("Password", { exact: true });
  const confirmation = () => page.getByLabel("Confirm password");

  async function signUp(path, email, { checkConfirmation = false } = {}) {
    await page.goto(path);
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

  // Sign-in links to sign-up.
  await page.goto("/login");
  await page.getByRole("link", { name: "Create one" }).click();
  await expect(page).toHaveURL(/\/register$/);

  await signUp("/register", `guest-${stamp}@example.com`, { checkConfirmation: true });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("guest-dashboard")).toBeVisible();
  // No name yet: the header shows the email.
  await expect(page.getByTestId("nav-user")).toHaveText(`guest-${stamp}@example.com`);

  // A guest on a partner page is sent to their own dashboard.
  await page.goto("/partner");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).not.toHaveURL(/\/partner/);

  // The name opens the account menu: Profile, Settings and Sign out.
  await page.getByTestId("nav-user").click();
  await page.getByTestId("nav-menu-profile").click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId("guest-profile")).toBeVisible();
  await expect(page.getByTestId("nav-user-menu")).toHaveCount(0);
  await page.getByTestId("nav-user").click();
  await page.getByTestId("nav-menu-signout").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("guest-signin")).toBeVisible();

  await signUp("/partner/register", `partner-${stamp}@example.com`);
  await expect(page).toHaveURL(/\/partner\/dashboard$/);
  await expect(page.getByTestId("partner-dashboard")).toBeVisible();

  // The partner header links between the partner pages and marks the current one.
  await expect(page.getByTestId("partner-nav-home")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("partner-nav-listings").click();
  await expect(page).toHaveURL(/\/partner\/listings$/);
  await expect(page.getByTestId("partner-listings")).toBeVisible();
  await page.getByTestId("partner-nav-calendar").click();
  await expect(page).toHaveURL(/\/partner\/calendar$/);
  await expect(page.getByTestId("partner-calendar")).toBeVisible();
  await page.getByTestId("partner-nav-inbox").click();
  await expect(page).toHaveURL(/\/partner\/inbox$/);
  await expect(page.getByTestId("partner-inbox")).toBeVisible();
  await expect(page.getByTestId("partner-nav-inbox")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("partner-nav-home").click();
  await expect(page.getByTestId("partner-dashboard")).toBeVisible();

  // The partner's account menu: Settings, Escape closes it, and Sign out.
  await page.getByTestId("nav-user").click();
  await page.getByTestId("nav-menu-settings").click();
  await expect(page).toHaveURL(/\/partner\/settings$/);
  await expect(page.getByTestId("partner-settings")).toBeVisible();
  await page.getByTestId("nav-user").click();
  await expect(page.getByTestId("nav-user-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("nav-user-menu")).toHaveCount(0);
  await page.getByTestId("nav-user").click();
  await page.getByTestId("nav-menu-signout").click();
  await expect(page).toHaveURL(/\/partner\/login$/);

  expect(errors).toEqual([]);
});
