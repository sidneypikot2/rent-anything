// What this proves: the web app renders without script errors, the server renders pages
// from the API, and the browser reaches the API through the same address and CORS setup a
// person's browser uses. It is a smoke
// test — one happy path through the parts everything else depends on, not feature
// coverage. Extend it as the core path grows (checkout next).
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bantayan Island");
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
  // Listings near Kota Beach are suggested too; take the landmark, named with its destination.
  await suggestions.getByRole("option", { name: "Kota Beach Bantayan Island" }).click();

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

  // A new guest's profile is incomplete: the banner leads to their own profile form (no
  // display name), here with a Metro Manila address, which has no province (RAA-40).
  await page.getByTestId("guest-profile-banner-link").click();
  await expect(page).toHaveURL(/\/profile$/);
  const guestForm = page.getByTestId("guest-profile-form");
  await expect(guestForm.getByLabel("Display name")).toHaveCount(0);
  await guestForm.getByLabel("First name").fill("Ana2");
  await guestForm.getByLabel("Last name").fill("Reyes");
  await guestForm.getByLabel("Phone", { exact: true }).fill("918 111 2222");
  await guestForm.getByRole("combobox", { name: "Region" }).fill("National Capital");
  await guestForm.getByRole("option", { name: "National Capital Region" }).click();
  await expect(guestForm.getByRole("combobox", { name: "Province" })).toBeDisabled();
  await guestForm.getByRole("combobox", { name: "City / Municipality" }).fill("Makati");
  await guestForm.getByRole("option", { name: "City of Makati" }).click();
  await guestForm.getByRole("combobox", { name: "ZIP code" }).fill("1200");
  await guestForm.getByLabel("Street").fill("12 Ayala Ave");
  // A name with a digit is caught before anything is sent; the form stays open.
  await page.getByTestId("guest-profile-save").click();
  await expect(guestForm.getByText("First name can only have letters")).toBeVisible();
  await guestForm.getByLabel("First name").fill("Ana");
  await expect(guestForm.getByText("First name can only have letters")).toHaveCount(0);
  await page.getByTestId("guest-profile-save").click();
  await expect(page.getByTestId("guest-profile-edit")).toBeVisible();
  await expect(page.getByTestId("guest-profile")).toContainText("+63 918 111 2222");
  await expect(page.getByTestId("guest-profile")).toContainText("City of Makati");
  await page.goto("/dashboard");
  await expect(page.getByTestId("guest-dashboard")).toBeVisible();
  await expect(page.getByTestId("guest-profile-banner")).toHaveCount(0);

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

  // A new partner's profile is incomplete: the banner leads to the profile form, and
  // saving it shows the profile read-only and hides the banner (RAA-40).
  await page.getByTestId("profile-banner-link").click();
  await expect(page).toHaveURL(/\/partner\/profile$/);
  await expect(page.getByTestId("profile-banner")).toHaveCount(0);
  const form = page.getByTestId("profile-form");
  await form.getByLabel("First name").fill("Jun");
  await form.getByLabel("Last name").fill("Dela Cruz");
  // Philippines only for now: the phone is the number after +63, and the address goes
  // from the fixed country down, each field suggesting places inside the one above it.
  await form.getByLabel("Phone", { exact: true }).fill("917 123 4567");
  await expect(form.getByLabel("Country", { exact: true })).toHaveValue(/Philippines/);
  await expect(form.getByLabel("Country", { exact: true })).toBeDisabled();
  await form.getByRole("combobox", { name: "Region" }).fill("central vis");
  await form.getByRole("option", { name: "Central Visayas" }).click();
  // Fields keep their places: Province is there before and after a region is picked.
  await expect(form.getByRole("combobox", { name: "Province" })).toBeEnabled();
  await form.getByRole("combobox", { name: "Province" }).fill("Cebu");
  await form.getByRole("option", { name: "Cebu", exact: true }).click();
  await form.getByRole("combobox", { name: "City / Municipality" }).fill("Moal");
  await form.getByRole("option", { name: "Moalboal" }).click();
  // Moalboal has one ZIP code, filled in for you.
  await expect(form.getByRole("combobox", { name: "ZIP code" })).toHaveValue("6032");
  await form.getByLabel("Street").fill("Poblacion East");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-edit")).toBeVisible();
  await expect(page.getByTestId("partner-profile")).toContainText("+63 917 123 4567");
  await expect(page.getByTestId("partner-profile")).toContainText("Moalboal");
  await page.getByTestId("profile-edit").click();
  await expect(page.getByTestId("profile-form").getByRole("combobox", { name: "City / Municipality" })).toHaveValue("Moalboal");
  await page.getByTestId("profile-cancel").click();
  await page.getByTestId("partner-nav-home").click();
  await expect(page.getByTestId("partner-dashboard")).toBeVisible();
  await expect(page.getByTestId("profile-banner")).toHaveCount(0);

  // The partner header links between the partner pages and marks the current one.
  await expect(page.getByTestId("partner-nav-home")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("partner-nav-listings").click();
  await expect(page).toHaveURL(/\/partner\/listings$/);
  await expect(page.getByTestId("partner-listings")).toBeVisible();
  // A new partner hasn't verified their ID (RAA-45): with the profile done, the banner asks
  // for it, and adding a listing leads to the verify page instead of the form. Didit
  // itself isn't called from here.
  await expect(page.getByTestId("verification-banner")).toBeVisible();
  await page.getByTestId("add-listing").click();
  await expect(page).toHaveURL(/\/partner\/listings\/new$/);
  await expect(page.getByTestId("listing-gate")).toBeVisible();
  await expect(page.getByTestId("listing-form")).toHaveCount(0);
  await page.getByTestId("listing-gate-verify").click();
  await expect(page).toHaveURL(/\/partner\/verify$/);
  await expect(page.getByTestId("verify-start")).toBeEnabled();
  await expect(page.getByTestId("verification-banner")).toHaveCount(0);
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

// Add to trip (RAA-66): signed out, the add is kept through sign-up and finishes back on
// the destination page with no second tap. With a trip, the next add asks which trip, and
// the toast leads to editing it and to the cart.
test("add to trip through sign-up", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);
  const stamp = Date.now();
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const from = day(30);
  const to = day(32);

  await page.goto(`/bantayan-island?from=${from}&to=${to}&guests=2`);
  await page.getByTestId("add-to-trip").first().click();
  const signIn = page.getByTestId("trip-signin-sheet");
  await expect(signIn).toBeVisible();
  await signIn.getByRole("link", { name: "Create one" }).click();

  await expect(page).toHaveURL(/\/register\?next=/);
  await page.getByLabel("Email").fill(`trip-${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(new RegExp(`/bantayan-island\\?from=${from}&to=${to}&guests=2$`));
  const toast = page.getByTestId("trip-toast");
  await expect(toast).toContainText("Added to Bantayan Island");
  await toast.getByRole("button", { name: "Dismiss" }).click();

  // The guest has a trip now, so the next add asks which, with that trip suggested.
  await page.getByTestId("add-to-trip").nth(1).click();
  const whichTrip = page.getByTestId("which-trip-sheet");
  await expect(whichTrip.getByText("Suggested")).toBeVisible();
  await whichTrip.getByTestId("which-trip-add").click();
  await expect(whichTrip).toHaveCount(0);
  await expect(toast).toContainText("Added to Bantayan Island");

  // Rename from the toast.
  await toast.getByRole("button", { name: "Rename" }).click();
  const edit = page.getByTestId("edit-trip-sheet");
  await edit.getByLabel("Trip name").fill(`Smoke trip ${stamp}`);
  await edit.getByTestId("edit-trip-save").click();
  await expect(toast).toContainText(`Saved Smoke trip ${stamp}`);

  // The cart (RAA-68): the header counts both items, View trip opens the trip, and an
  // item can be removed.
  await expect(page.getByTestId("nav-cart-count")).toHaveText("2");
  await toast.getByTestId("trip-toast-view").click();
  await expect(page).toHaveURL(/\/cart\?trip=\d+$/);
  const trip = page.getByTestId("cart-trip").filter({ hasText: `Smoke trip ${stamp}` });
  await expect(trip.getByTestId("cart-trip-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(trip.getByTestId("cart-item")).toHaveCount(2);
  await trip.getByTestId("cart-item-menu").first().click();
  await trip.getByTestId("item-action-remove").click();
  await page.getByTestId("remove-item-confirm").click();
  await expect(trip.getByTestId("cart-item")).toHaveCount(1);
  await expect(page.getByTestId("nav-cart-count")).toHaveText("1");

  expect(errors).toEqual([]);
});
