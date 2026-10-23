// What this proves: the web app renders without script errors, the server renders pages
// from the API, and the browser reaches the API through the same address and CORS setup a
// person's browser uses. It is a smoke
// test — one happy path through the parts everything else depends on, not feature
// coverage. Extend it as the core path grows (payments next).
import { test, expect } from "@playwright/test";

// Uncaught exceptions and console errors: a page that renders but logs errors is broken.
// Except Google sign-in's own failed requests: Google answers 403 to any origin not
// registered on the OAuth client, and only port 8100 is, so a worktree (8100+N) always
// gets them. The message's text has no URL; its location is the failed resource.
function collectErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource") && isGoogle(message.location().url)) return;
    // Google Sign-In knows only port 8100: a worktree stack (8100+N) logs this on every page with
    // its button. CI runs on 8100, where it never shows.
    if (message.text().includes("The given origin is not allowed for the given client ID")) return;
    errors.push(`console: ${message.text()}`);
  });
}

function isGoogle(url) {
  return URL.canParse(url) && new URL(url).hostname === "accounts.google.com";
}

test("home page renders and reaches the API", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bantayan Island");
  await expect(page.getByTestId("nav-signin")).toBeVisible();
  await expect(page.getByTestId("nav-register")).toHaveAttribute("href", "/register");
  // Rendered on the server from the API (the sample destinations, RAA-33): those beyond the
  // launch area, as links while there are few, as cards once there are more.
  await expect(page.getByTestId(/^destination-(card|link)$/).first()).toBeVisible();
  await expect(page.getByTestId("activity-card").first()).toBeVisible();

  expect(errors).toEqual([]);
});

// The search box asks the API from the browser (CORS and ports), then leads to a
// destination page rendered on the server, and on to one of its listings.
test("search a landmark and open its destination", async ({ page }) => {
  // Four pages and the search bar's round trip: more than the default 30s on a cold dev server.
  test.setTimeout(60_000);
  const errors = [];
  collectErrors(page, errors);

  await page.goto("/");
  await page.getByTestId("search-input").fill("kota");
  const suggestions = page.getByTestId("search-suggestions");
  await expect(suggestions).toContainText("Kota Beach");
  // Listings near Kota Beach are suggested too; take the landmark, named with its destination.
  await suggestions.getByRole("option", { name: "Kota Beach Bantayan Island" }).click();
  // Picking a place opens nothing yet: the dates come next, and Search goes there.
  await expect(page.getByTestId("search-input")).toHaveValue("Kota Beach");
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("search-submit").click();

  await expect(page).toHaveURL(/\/bantayan-island#kota-beach$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bantayan Island");
  await expect(page.locator("#kota-beach")).toBeVisible();

  // The header's search names the place; its pill opens the search, and new guests apply to
  // this page (RAA-126).
  const bar = page.getByTestId("search-bar");
  await expect(bar.getByTestId("search-bar-pill")).toContainText("Bantayan Island");
  await bar.getByTestId("search-bar-pill").click();
  await expect(bar.getByTestId("search-input")).toHaveValue("Bantayan Island");
  await bar.getByTestId("search-guests").click();
  await bar.getByTestId("search-guests-count-more").click();
  await bar.getByTestId("search-submit").click();
  await expect(page).toHaveURL(/\/bantayan-island\?guests=2$/);
  await expect(bar.getByTestId("search-bar-pill")).toContainText("2 guests");

  // What to book lists businesses: a card opens a side panel (RAA-126) with the business's
  // listings in that group, or, for a business with one, that listing's details at once. A
  // listing's details link to its page, also rendered on the server, with its own Add to trip.
  await page.getByTestId("business-open").first().click();
  const panel = page.getByTestId("detail-panel");
  const offers = panel.getByTestId("business-offer");
  if (await offers.count()) {
    await offers.first().click();
    await expect(panel.getByTestId("business-back")).toBeVisible();
  }
  const listingTitle = (await panel.getByRole("heading", { level: 2 }).textContent()).trim();
  await panel.getByTestId("listing-link").click();
  await expect(page).toHaveURL(/\/listings\/\d+\?guests=2$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(listingTitle);
  await expect(page.getByTestId("add-to-trip")).toBeVisible();

  // Enter on the home search with several matches opens the results page, which lists them.
  await page.goto("/");
  await page.getByTestId("search-input").fill("snorkelling");
  await page.getByTestId("search-input").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=snorkelling$/);
  await expect(page.getByTestId("search-results")).toContainText("Bantayan Island");

  // On a place's page the search bar searches that place's things to book, says what it found
  // and offers every place.
  await page.goto("/bantayan-island");
  const placeBar = page.getByTestId("search-bar");
  // Filled in once the page has named its place, which would replace anything typed before.
  await expect(placeBar.getByTestId("search-bar-pill")).toContainText("Bantayan Island");
  await placeBar.getByTestId("search-bar-pill").click();
  await expect(placeBar.getByTestId("search-input")).toHaveValue("Bantayan Island");
  await placeBar.getByTestId("search-input").fill("snorkelling");
  await placeBar.getByTestId("search-input").press("Enter");
  await expect(page).toHaveURL(/\/bantayan-island\?q=snorkelling#listings$/);
  const searched = page.getByTestId("searched-line");
  await expect(searched).toContainText("snorkelling");
  await searched.getByRole("link", { name: "Search all places" }).click();
  await expect(page).toHaveURL(/\/search\?q=snorkelling$/);

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
  ["/admin/ui-kit", "Sky & Forest", "ui-kit"],
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
// the toast leads to editing it and to the cart, where the item left is booked (RAA-133).
test("add to trip through sign-up", async ({ page }) => {
  // Sign-up, the add, the cart, checkout and the Trips page: more than the default 30s.
  test.setTimeout(60_000);
  const errors = [];
  collectErrors(page, errors);
  const stamp = Date.now();
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  // A different stretch each run, so bookings left by earlier runs don't fill these days.
  const offset = 30 + (Math.floor(stamp / 1000) % 240);
  const from = day(offset);
  const to = day(offset + 2);

  await page.goto(`/bantayan-island?from=${from}&to=${to}&guests=2`);
  await page.getByTestId("add-to-trip").first().click();
  const signIn = page.getByTestId("trip-signin-sheet");
  await expect(signIn).toBeVisible();
  await signIn.getByTestId("trip-signin-create").click();

  await expect(page).toHaveURL(/\/register\?next=/);
  await page.getByLabel("Email").fill(`trip-${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(new RegExp(`/bantayan-island\\?from=${from}&to=${to}&guests=2$`));
  // Every add is confirmed in the add sheet, the first one too: it starts a new trip.
  const firstAdd = page.getByTestId("which-trip-sheet");
  await expect(firstAdd.getByTestId("add-sheet-listing")).toBeVisible();
  await firstAdd.getByTestId("which-trip-add").click();
  await expect(firstAdd).toHaveCount(0);
  const toast = page.getByTestId("trip-toast");
  await expect(toast).toContainText("Added to Bantayan Island");
  await toast.getByRole("button", { name: "Dismiss" }).click();
  // The place's page stays the place's, saying the guest has a trip here; View trip opens it in the cart.
  await expect(page.getByTestId("trip-notice-open")).toHaveAttribute("href", /^\/cart\?trip=\d+$/);

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

  // The cart (RAA-68, RAA-135): the header counts both items, View trip shows the trip, picked
  // in the trips beside it, and an item can be removed.
  await expect(page.getByTestId("nav-cart-count")).toHaveText("2");
  await toast.getByTestId("trip-toast-view").click();
  await expect(page).toHaveURL(/\/cart\?trip=\d+$/);
  await expect(page.getByTestId("cart-trip-tab").filter({ hasText: `Smoke trip ${stamp}` })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const trip = page.getByTestId("cart-trip").filter({ hasText: `Smoke trip ${stamp}` });
  await expect(trip.getByTestId("cart-item")).toHaveCount(2);
  await trip.getByTestId("cart-item-menu").first().click();
  await trip.getByTestId("item-action-remove").click();
  await page.getByTestId("remove-item-confirm").click();
  await expect(trip.getByTestId("cart-item")).toHaveCount(1);
  await expect(page.getByTestId("nav-cart-count")).toHaveText("1");

  // Checkout (RAA-133): the item left is ticked; sending it makes a request that waits for its
  // partner (RAA-134), and the cart then shows its booking.
  await expect(trip.getByTestId("cart-item-pick")).toBeChecked();
  await trip.getByTestId("cart-checkout").click();
  const checkout = page.getByTestId("checkout-sheet");
  await checkout.getByTestId("checkout-confirm").click();
  await expect(checkout.getByTestId("checkout-result").getByTestId("booking-status")).toHaveText("Request sent");
  await checkout.getByRole("button", { name: "Done" }).click();
  await expect(trip.getByTestId("cart-item").getByTestId("booking-status")).toHaveText("Request sent");
  await expect(trip.getByTestId("cart-item-pick")).toHaveCount(0);

  // The item's panel (RAA-135) shows its booking, and editing it sends the change to the partner.
  await trip.getByTestId("cart-item-open").click();
  const panel = page.getByTestId("cart-item-panel");
  await expect(panel.getByTestId("item-panel-booking").getByTestId("booking-status")).toHaveText("Request sent");
  await panel.getByTestId("item-panel-edit").click();
  const change = page.getByTestId("change-booking-sheet");
  await change.getByTestId("change-booking-guests-less").click();
  await change.getByTestId("change-booking-send").click();
  await expect(page.getByTestId("cart-toast")).toContainText("Change sent to the partner");

  // Find more opens the trip's destinations, each a link to its page.
  await trip.getByTestId("cart-find-more").click();
  const findMore = page.getByTestId("find-more-sheet");
  await expect(findMore.getByTestId("find-more-area").first()).toHaveAttribute("href", /^\/[a-z0-9-]+(\?|$)/);
  await page.keyboard.press("Escape");
  await expect(findMore).toHaveCount(0);

  // The Trips page (RAA-140) lists the booked trip as upcoming, day by day, then its booking.
  await page.goto("/trips");
  await expect(page.getByTestId("trip-group").first()).toHaveText("Upcoming");
  const booked = page.getByTestId("cart-trip").filter({ hasText: `Smoke trip ${stamp}` });
  await expect(booked.getByTestId("trip-status")).toHaveText("Booked");
  await expect(booked.getByTestId("itinerary-day").first()).toBeVisible();
  await booked.getByTestId("trip-view-items").click();
  await expect(booked.getByTestId("cart-item").getByTestId("booking-status")).toHaveText("Request sent");

  // Past and Cancelled are tabs over the sidebar; nothing is past or cancelled yet.
  await page.getByTestId("trips-tab-past").click();
  await expect(page.getByTestId("trips-past-empty")).toBeVisible();
  await expect(booked).toHaveCount(0);
  await page.getByTestId("trips-tab-cancelled").click();
  await expect(page.getByTestId("past-bookings-empty")).toBeVisible();
  await page.getByTestId("trips-tab-upcoming").click();
  await expect(booked).toBeVisible();

  expect(errors).toEqual([]);
});
