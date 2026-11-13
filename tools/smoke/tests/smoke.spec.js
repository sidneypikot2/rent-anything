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
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Live on Bantayan")).toBeVisible();
  await expect(page.getByTestId("nav-signin")).toBeVisible();
  await expect(page.getByTestId("nav-register")).toHaveAttribute("href", "/register");
  // The home's three ways in: Plan a trip (below), Book one thing to the launch area's What
  // to book, and Explore to the launch area's page.
  await expect(page.getByTestId("home-book-one")).toHaveAttribute("href", "/bantayan-island/book");
  await expect(page.getByTestId("home-explore")).toHaveAttribute("href", "/bantayan-island");
  // Under the hero: the five kinds of things to book, and the places to see, rendered on the
  // server from the API, each opening its card on the launch area's page.
  await expect(page.getByTestId("home-service")).toHaveCount(5);
  await expect(page.getByTestId("home-place").first()).toHaveAttribute("href", /^\/bantayan-island#[a-z0-9-]+$/);

  expect(errors).toEqual([]);
});

// The search box asks the API from the browser (CORS and ports), then leads to a
// destination page rendered on the server, and on to one of its listings.
test("plan a whole trip: where, when and who, then the checklist", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  collectErrors(page, errors);

  await page.goto("/");
  await page.getByTestId("plan-whole-trip").click();
  await expect(page).toHaveURL(/\/plan$/);
  // Step 1's way back leaves the planner, so it asks first; Stay keeps the guest here.
  await page.getByTestId("plan-back").click();
  await expect(page.getByTestId("leave-plan")).toBeVisible();
  await page.getByTestId("leave-plan-stay").click();
  await expect(page.getByTestId("leave-plan")).toBeHidden();
  await expect(page).toHaveURL(/\/plan$/);
  await page.getByTestId("plan-dates").click();
  const days = page.locator("[role=grid] button:not([disabled])");
  await days.nth(10).click();
  await days.nth(12).click();
  await page.getByTestId("plan-dates-ok").click();
  // Next starts the trip (a guest with no account, signed out) and opens its checklist.
  // Step 1 shows the planner's whole track, Trip lit, from Trip to Review.
  await expect(page.getByTestId("plan-step-trip")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("plan-step-review")).toBeVisible();
  await page.getByTestId("plan-next").click();
  await expect(page).toHaveURL(/\/plan\/bantayan-island\?trip=\d+/);
  // Places to see is the first step: a heart picks one, the step stays open, and Next finds a
  // stay near it.
  await expect(page.getByTestId("plan-see")).toBeVisible();
  await page.getByTestId("plan-see-card").first().getByTestId("landmark-save").click();
  await expect(page.getByTestId("plan-picks-tray")).toContainText("1 place picked");
  await expect(page.getByTestId("plan-see")).toBeVisible();
  await page.getByTestId("plan-foot-next").click();
  // The place's stays are under Find me one here, each saying how far it is from the pick.
  await page.getByTestId("plan-stay-find").click();
  await expect(page.getByTestId("plan-options-stay")).toBeVisible();
  await expect(page.getByTestId("plan-near").first()).toBeVisible();
  // A stay's card opens its shop in the planner's frame, under the same stepper, and its way back
  // returns to the step (RAA-309).
  await page.getByTestId("plan-option").first().click();
  await expect(page).toHaveURL(/[?&]business=\d+/);
  await expect(page.getByTestId("plan-over")).toBeVisible();
  await expect(page.getByTestId("plan-step-stay")).toHaveAttribute("aria-current", "step");
  await page.getByTestId("plan-over-back").click();
  await expect(page.getByTestId("plan-options-stay")).toBeVisible();
  // The steps sit in a row; picking one shows its options, Things to do with its places.
  await page.getByTestId("plan-step-activity").click();
  await expect(page.getByTestId("plan-places-tours")).toBeVisible();
  // The foot's trip button shows only once a listing is in the trip, and Next stays the main
  // button; Review is the track's last stop.
  await expect(page.getByTestId("plan-trip-open")).toHaveCount(0);
  await page.getByTestId("plan-step-review").click();
  await expect(page).toHaveURL(/\/plan\/bantayan-island\/review\?trip=\d+/);
  await expect(page.getByTestId("plan-days")).toBeVisible();
  // The pick from step 2 is in the places panel, undecided until the guest says how.
  await expect(page.getByTestId("plan-places-count")).toHaveText("0 of 1 sorted");
  await page.getByTestId("plan-pick-choose").first().click();
  await page.getByTestId("plan-way-skip").click();
  await page.getByTestId("plan-chooser-save").click();
  await expect(page.getByTestId("plan-places-count")).toHaveText("1 of 1 sorted");
  // Review keeps the track: a step on it goes back to that step on the checklist.
  await expect(page.getByTestId("plan-step-review")).toHaveAttribute("aria-current", "step");
  await page.getByTestId("plan-step-stay").click();
  await expect(page).toHaveURL(/\/plan\/bantayan-island\?trip=\d+&choose=stay$/);
  await expect(page.getByTestId("plan-step-stay")).toHaveAttribute("aria-current", "step");
  // Planning again with a trip already made asks which on the home page; the trip has dates, so
  // continuing it opens its checklist.
  const tripId = new URL(page.url()).searchParams.get("trip");
  await page.goto("/");
  await page.getByTestId("plan-whole-trip").click();
  await expect(page.getByTestId("trip-choice-sheet")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("trip-choice-go").click();
  await expect(page).toHaveURL(new RegExp(`/plan/bantayan-island\\?trip=${tripId}$`));
  // The browser's Back from the step the planner was entered on asks too; Leave goes home.
  await page.goBack();
  await expect(page.getByTestId("leave-plan")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/plan/bantayan-island\\?trip=${tripId}$`));
  await page.getByTestId("leave-plan-leave").click();
  await expect(page).toHaveURL(/\/$/);
  // A place page's Plan a trip asks too, with the trip here picked; New trip goes to step 1 on it.
  await page.goto("/bantayan-island");
  await page.getByTestId("area-trip-band-plan").click();
  await expect(page.getByTestId("trip-choice-sheet")).toBeVisible();
  await expect(page.getByTestId("trip-choice-go")).toHaveText(/Continue this trip/);
  await page.getByTestId("trip-choice-sheet").getByText("New trip").click();
  await page.getByTestId("trip-choice-go").click();
  await expect(page).toHaveURL(/\/plan\?where=bantayan-island$/);
  expect(errors).toEqual([]);
});

test("search a landmark and open its destination", async ({ page }) => {
  // Four pages and the search bar's round trip: more than the default 30s on a cold dev server.
  test.setTimeout(60_000);
  const errors = [];
  collectErrors(page, errors);

  // The home page (the team's E) has no search: start from the results page's, which has no place.
  await page.goto("/search");
  const homeBar = page.getByTestId("search-bar");
  await homeBar.getByTestId("search-bar-pill").click();
  await homeBar.getByTestId("search-input").fill("kota");
  const suggestions = homeBar.getByTestId("search-suggestions");
  await expect(suggestions).toContainText("Kota Beach");
  // Listings near Kota Beach are suggested too; take the landmark, named with its destination.
  await suggestions.getByRole("option", { name: "Kota Beach Bantayan Island" }).click();
  // Picking a place opens nothing yet: the dates come next, and Search goes there.
  await expect(homeBar.getByTestId("search-input")).toHaveValue("Kota Beach");
  await expect(page).toHaveURL(/\/search$/);
  await homeBar.getByTestId("search-submit").click();

  await expect(page).toHaveURL(/\/bantayan-island#kota-beach$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bantayan Island");
  await expect(page.locator("#kota-beach")).toBeVisible();

  // The area page has no header search: the guests come in the URL, and the page keeps them.
  await expect(page.getByTestId("search-bar-pill")).toBeHidden();
  await page.goto("/bantayan-island?guests=2");

  // The page gets to know the place (RAA-252): how to get there, and the section bar's Plan a trip,
  // which opens the whole-trip planner on this place with the page's guests.
  await expect(page.getByTestId("area-getting-here")).toContainText("Getting to Bantayan Island");
  await expect(page.getByTestId("area-nav-plan")).toHaveAttribute("href", "/plan?where=bantayan-island&guests=2");

  // What to book has its own page (2026-11-10), which the banner's phone lead opens with the
  // guests; the section bar has no tab for it.
  await expect(page.getByTestId("area-nav-listings")).toHaveCount(0);
  await expect(page.getByTestId("trip-lead-compact")).toHaveAttribute("href", "/bantayan-island/book?guests=2");
  await page.goto("/bantayan-island/book?guests=2");

  // What to book lists a card per listing title per business ("Mio 125 by …"; a stay's per
  // business): a title card opens its cheapest listing's page, a stay's card the business's own
  // page, in a new tab on a laptop, with the search's guests and the group it came from. The
  // business's options' titles open the listing's page (no side panel since 2026-11-10), also rendered on the
  // server, in another new tab, with its own Add to trip. A vehicle shop's models open their details in place instead (RAA-205),
  // which link to the listing's page in the same tab.
  await expect(page.locator('[data-testid="business-open"][href^="/listings/"]').first()).toHaveAttribute(
    "href",
    /^\/listings\/\d+-[a-z0-9-]+\?guests=2&place=bantayan-island$/,
  );
  const stayCard = page.locator('[data-testid="business-open"][href^="/businesses/"]').first();
  const [business] = await Promise.all([page.waitForEvent("popup"), stayCard.click()]);
  await expect(business).toHaveURL(/\/businesses\/\d+\?guests=2&show=need-stay&place=bantayan-island$/);
  await expect(business.getByTestId("business-options-list")).toBeVisible();
  const models = business.getByTestId("shop-model-toggle");
  let listing = business;
  let listingTitle;
  if (await models.count()) {
    listingTitle = (await business.getByTestId("shop-model-title").first().textContent()).trim();
    await models.first().click();
    await expect(models.first()).toHaveAttribute("aria-expanded", "true");
    await business.getByTestId("listing-link").first().click();
  } else {
    const offer = business.getByTestId("business-offer").first();
    listingTitle = (await offer.textContent()).trim();
    [listing] = await Promise.all([business.waitForEvent("popup"), offer.click()]);
  }
  await expect(listing).toHaveURL(/\/listings\/\d+-[a-z0-9-]+\?guests=2&place=bantayan-island$/);
  await expect(listing.getByRole("heading", { level: 1 })).toHaveText(listingTitle);
  // Laid out as its business's shop (the booking rail): the booking card on the right holds its
  // Add to trip, and the rest of the business follows under "More from".
  await expect(listing.getByTestId("listing-book").getByTestId("add-to-trip")).toBeVisible();
  await expect(listing.getByTestId("listing-business")).toBeVisible();
  if (listing !== business) await listing.close();
  await business.close();

  // A search with several matches opens the results page, which lists them.
  await page.goto("/search");
  await homeBar.getByTestId("search-bar-pill").click();
  await homeBar.getByTestId("search-input").fill("snorkelling");
  await homeBar.getByTestId("search-submit").click();
  await expect(page).toHaveURL(/\/search\?q=snorkelling$/);
  await expect(page.getByTestId("search-results")).toContainText("Bantayan Island");

  // A place's What to book opened with a search (`?q=`, from a listing's header search) narrows
  // its things to book, says what it found and offers every place.
  await page.goto("/bantayan-island/book?q=snorkelling");
  const searched = page.getByTestId("searched-line");
  await expect(searched).toContainText("snorkelling");
  await searched.getByRole("link", { name: "Search all places" }).click();
  await expect(page).toHaveURL(/\/search\?q=snorkelling$/);

  // A section's filters are its own and run on the server: Manual (1 of the 3 seeded rentals)
  // leaves fewer, and Clear brings them back. Seeded rentals share one price, so the price
  // range doesn't show here.
  await page.goto("/bantayan-island/book?show=need-rental");
  await expect(page.getByTestId("business-open").first()).toBeVisible();
  const rentals = await page.getByTestId("business-open").count();
  await page.getByTestId("section-filter").click();
  const apply = page.getByTestId("filter-apply");
  await expect(apply).toHaveText(`Show ${rentals} results`);
  await page.getByTestId("filter-dialog").getByRole("button", { name: /^Manual/ }).click();
  const shown = async () => Number(((await apply.textContent()) ?? "").match(/\d+/)?.[0] ?? -1);
  await expect.poll(shown).toBeLessThan(rentals);
  const manual = await shown();
  await apply.click();
  await expect(page.getByTestId("business-open")).toHaveCount(manual);
  await page.getByRole("button", { name: "Clear" }).first().click();
  await expect(page.getByTestId("business-open")).toHaveCount(rentals);

  // Each section is a sideways row, 6 loaded and 3 in view (2026-11-11); Show all, past 6,
  // opens the section alone in a new tab, 10 a page (the 8 seeded gear cards on one).
  await page.goto("/bantayan-island/book?show=need-gear");
  await expect(page.getByTestId("business-open")).toHaveCount(6);
  const [showAll] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("show-all").first().click()]);
  await expect(showAll).toHaveURL(/\/bantayan-island\/book\/gear$/);
  await expect(showAll.getByTestId("business-open")).toHaveCount(8);
  await showAll.close();

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

// robots.txt and sitemap.xml (RAA-244, RAA-232, RAA-247). This stack, like staging, isn't
// indexable (no NEXT_PUBLIC_SITE_INDEXABLE=true), so robots.txt shuts crawlers out and every page
// says noindex; the sitemap still lists the public pages, the areas and the listings, and each
// of its pages opens.
test("robots.txt, sitemap.xml and noindex", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/^Disallow: \/$/m);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("<urlset");
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  for (const path of ["/", "/about", "/terms", "/privacy", "/refunds", "/partner-terms", "/bantayan-island"]) {
    expect(paths).toContain(path);
  }
  const listings = paths.filter((path) => path.startsWith("/listings/"));
  expect(listings.length).toBeGreaterThan(0);
  // Every page but the listings past the first few (each renders the same way).
  for (const path of [...paths.filter((path) => !path.startsWith("/listings/")), ...listings.slice(0, 3)]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }

  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

  // The /nearby test page (RAA-248) stays up but out of search: noindex of its own (production
  // too) and not in the sitemap.
  expect(paths).not.toContain("/nearby");
  await page.goto("/nearby");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

// Page metadata (RAA-227, RAA-228, RAA-229, RAA-238): each public page has its own description
// and one canonical link, absolute and without the query; a search's results stay out of the index.
test("page titles, descriptions and canonical links", async ({ request }) => {
  const head = async (path) => {
    const response = await request.get(path, { headers: { "User-Agent": "Googlebot" } });
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((match) => match[1]);
    return {
      title: html.match(/<title>([^<]*)<\/title>/)?.[1],
      description: html.match(/<meta name="description" content="([^"]*)"/)?.[1],
      robots: html.match(/<meta name="robots" content="([^"]*)"/)?.[1],
      canonicals,
    };
  };

  const listing = (await (await request.get("/sitemap.xml")).text()).match(/<loc>([^<]*\/listings\/\d+-[a-z0-9-]+)<\/loc>/)[1];
  const pages = {
    "/": "/",
    "/bantayan-island?from=2030-01-01&utm_source=test": "/bantayan-island",
    "/bantayan-island/book": "/bantayan-island/book",
    [new URL(listing).pathname]: new URL(listing).pathname,
    "/search": "/search",
    "/about": "/about",
    "/terms": "/terms",
    "/privacy": "/privacy",
    "/refunds": "/refunds",
    "/partner-terms": "/partner-terms",
  };
  const descriptions = new Set();
  for (const [path, canonicalPath] of Object.entries(pages)) {
    const { description, canonicals } = await head(path);
    expect(description, path).toBeTruthy();
    descriptions.add(description);
    expect(canonicals, path).toHaveLength(1);
    const url = new URL(canonicals[0]);
    expect(url.protocol, path).toMatch(/^https?:$/);
    expect(url.pathname, path).toBe(canonicalPath);
    expect(url.search, path).toBe("");
  }
  expect(descriptions.size).toBe(Object.keys(pages).length);

  expect((await head("/bantayan-island")).title).toContain("Bantayan Island");
  expect((await head("/search?q=boat")).robots).toContain("noindex");
});

// Shared links and structured data (RAA-233, RAA-241): the home, an area and a listing each
// have Open Graph and Twitter tags with an image that loads, and server-rendered JSON-LD that
// parses — the home naming the business and the site's search, an area its place and
// breadcrumbs, a listing itself and its breadcrumbs.
test("Open Graph tags and JSON-LD", async ({ request }) => {
  const listing = new URL((await (await request.get("/sitemap.xml")).text()).match(/<loc>([^<]*\/listings\/\d+-[a-z0-9-]+)<\/loc>/)[1]).pathname;
  const expected = { "/": ["Organization", "WebSite"], "/bantayan-island": ["BreadcrumbList"], [listing]: ["BreadcrumbList"] };
  for (const [path, types] of Object.entries(expected)) {
    const html = await (await request.get(path)).text();
    const meta = (attribute, name) => html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`))?.[1];
    expect(meta("property", "og:title"), path).toBeTruthy();
    expect(meta("property", "og:description"), path).toBeTruthy();
    expect(meta("property", "og:site_name"), path).toBeTruthy();
    expect(meta("name", "twitter:card"), path).toBe("summary_large_image");
    const image = new URL(meta("property", "og:image"));
    // The default image is this site's own; a cover photo is the storage's.
    if (image.pathname.startsWith("/opengraph-image")) {
      const response = await request.get(image.pathname);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toBe("image/png");
    }
    const nodes = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([^<]*)<\/script>/g)].flatMap((match) => {
      const data = JSON.parse(match[1]);
      return data["@graph"] ?? [data];
    });
    const found = nodes.flatMap((node) => [node["@type"]].flat());
    for (const type of types) expect(found, path).toContain(type);
  }
  expect((await request.get("/logo.png")).status()).toBe(200);
});

// One h1 per page (RAA-243, RAA-235): the public pages and sign-in each have exactly one, in the
// server's HTML (what a crawler reads) and once the page has run in the browser; the not-found
// pages answer 404 (a missing place, What to book group or plan too, RAA-246: their checks sit
// above the loading skeletons, in layouts) and have one in the browser. Next draws a notFound()'s
// page in the browser, so it has none in the server's HTML yet. The error page (app/(guest)/error.tsx) can't be
// reached from here: it needs the API to fail.
test("one h1 per page", async ({ page, request }) => {
  const listing = new URL((await (await request.get("/sitemap.xml")).text()).match(/<loc>([^<]*\/listings\/\d+-[a-z0-9-]+)<\/loc>/)[1]).pathname;
  const pages = [
    "/", "/bantayan-island", "/bantayan-island/book", "/bantayan-island/book/gear", listing, "/search", "/search?q=boat", "/about",
    "/terms", "/privacy", "/refunds", "/partner-terms", "/login", "/register",
  ];
  const missing = [
    "/no-such-place", "/bantayan-island/book/no-such-group", "/plan/no-such-place", "/plan/no-such-place/review",
    "/listings/999999999", "/businesses/999999999", "/no/such/page",
  ];
  for (const path of [...pages, ...missing]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(missing.includes(path) ? 404 : 200);
    if (!missing.includes(path)) {
      expect((await response.text()).match(/<h1[\s>]/g) ?? [], `${path}: h1s in the server HTML`).toHaveLength(1);
    }
    await page.goto(path);
    await expect(page.locator("h1"), `${path}: h1s in the page`).toHaveCount(1);
  }
});

// Readable listing URLs (RAA-236): the sitemap lists `/listings/<id>-<slug>`, and the bare id or
// an old title answers 308 to it with the query kept, as the guest flow's links need (`?place=`,
// `&from=place`, the dates). Breadcrumbs (RAA-237): the listing and its place show the trail
// Home › place (› listing) in the server's HTML, and the footer links every destination.
test("listing URLs and breadcrumbs", async ({ request, baseURL }) => {
  const canonical = new URL((await (await request.get("/sitemap.xml")).text()).match(/<loc>([^<]*\/listings\/\d+-[a-z0-9-]+)<\/loc>/)[1]).pathname;
  const id = canonical.match(/^\/listings\/(\d+)-/)[1];
  const query = "place=bantayan-island&from=place&guests=2";
  for (const old of [`/listings/${id}`, `/listings/${id}-an-old-title`]) {
    const response = await request.get(`${old}?${query}`, { maxRedirects: 0 });
    expect(response.status(), old).toBe(308);
    const location = new URL(response.headers().location, baseURL);
    expect(`${location.pathname}${location.search}`, old).toBe(`${canonical}?${query}`);
  }
  const listing = await request.get(`${canonical}?${query}`, { maxRedirects: 0 });
  expect(listing.status()).toBe(200);

  const crumbs = (html) =>
    [...(html.match(/<nav[^>]*data-testid="breadcrumbs"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "").matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  const listingHtml = await listing.text();
  expect(crumbs(listingHtml)[0]).toBe("/");
  expect(crumbs(listingHtml)).toContain("/bantayan-island");
  const placeHtml = await (await request.get("/bantayan-island")).text();
  expect(crumbs(placeHtml)).toEqual(["/"]);
  expect(placeHtml).toMatch(/data-testid="footer-nav"[\s\S]*href="\/bantayan-island"/);
});

// No broken links (RAA-234): from the home page, follow same-origin links in the server's HTML
// (what a crawler reads), breadth first, and every link found must open (after redirects) below
// 400. Bounded: at most PAGES pages are read for their links, and at most PER_SHAPE of one shape
// (`/listings/12-boat-tour` and `/listings/34-kayak` are one), so a growing catalogue doesn't grow the test.
// External links are checked by hand, not here: their sites block or rate-limit robots.
test("no broken links", async ({ request, baseURL }) => {
  test.setTimeout(240_000);
  const PAGES = 40;
  const PER_SHAPE = 3;
  const shape = (url) => `${url.pathname.replace(/^\/listings\/\d+-[^/]*/, "/listings/:n").replace(/\d+/g, ":n")}?${[...url.searchParams.keys()].sort().join("&")}`;
  const linksIn = (html) => [...html.matchAll(/<a\s(?:[^>]*?\s)?href="([^"]*)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  const origin = new URL(baseURL).origin;
  const seen = new Map(); // url -> the page that linked it first
  const shapes = new Map();
  const queue = ["/"];
  seen.set("/", "(start)");
  const broken = [];
  let read = 0;
  while (queue.length) {
    const path = queue.shift();
    const response = await request.get(path);
    if (response.status() >= 400) {
      broken.push(`${path} (${response.status()}), linked from ${seen.get(path)}`);
      continue;
    }
    if (read >= PAGES || !(response.headers()["content-type"] ?? "").includes("text/html")) continue;
    read += 1;
    for (const href of linksIn(await response.text())) {
      if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/.test(href)) continue;
      const url = new URL(href, `${origin}${path}`);
      if (url.origin !== origin) continue;
      url.hash = "";
      const key = `${url.pathname}${url.search}`;
      if (seen.has(key)) continue;
      const count = shapes.get(shape(url)) ?? 0;
      if (count >= PER_SHAPE) continue;
      shapes.set(shape(url), count + 1);
      seen.set(key, path);
      queue.push(key);
    }
  }
  expect(read, "pages read for links").toBeGreaterThan(5);
  expect(broken).toEqual([]);
});

// Sign-up through the real API (email and password only), and the /partner guard: signed
// out goes to /partner/login, a guest is sent home, a partner gets the dashboard.
// Sent before the page's JavaScript loads, the browser posts the form itself (RAA-269): a GET
// would put the password in the URL.
test("a sign-in sent before the page loads keeps the password out of the URL", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/partner/login");
  await page.getByLabel("Email").fill("early@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  const sent = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  expect((await sent).status()).toBe(200);
  expect(page.url()).not.toContain("password123");
  await context.close();
});

// Password reset and email confirmation (RAA-215): sign-in's Forgot password? asks for a link and
// says "if" whatever the email; the emailed links' pages drop their token from the URL at once
// and say when it is no good. A real token needs the email, so only a bad one is tried here.
test("forgot password, and the emailed links with a bad token", async ({ page }) => {
  const errors = [];
  collectErrors(page, errors);

  await page.goto("/login");
  await page.getByTestId("forgot-password-link").click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByTestId("forgot-password-sent")).toContainText("If an account");

  await page.goto("/reset-password?token=not-a-token");
  await expect(page.getByTestId("reset-password")).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByTestId("reset-password-error")).toContainText("invalid or has expired");

  await page.goto("/confirm-email?token=not-a-token");
  await expect(page.getByTestId("confirm-email-error")).toContainText("invalid or has expired");
  await expect(page).toHaveURL(/\/confirm-email$/);

  // The API's 422s for the bad tokens are the only errors.
  expect(errors.filter((error) => !error.includes("status of 422"))).toEqual([]);
});

test("sign-up and the partner guard", async ({ page }) => {
  // Two sign-ups and most of the partner pages: about a minute, more on a cold dev server.
  test.setTimeout(180_000);
  const errors = [];
  collectErrors(page, errors);
  const stamp = Date.now();

  const password = () => page.getByLabel("Password", { exact: true });
  const confirmation = () => page.getByLabel("Confirm password");

  async function signUp(path, email, { checkConfirmation = false } = {}) {
    await page.goto(path);
    await page.getByLabel("Email").fill(email);
    await password().fill("password123");
    await confirmation().fill("password123");
    // The Terms and Privacy policy must be agreed to: the form isn't sent without it.
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.getByTestId("consent").check();

    if (checkConfirmation) {
      // The two fields show and hide together.
      await page.getByRole("button", { name: "Show", exact: true }).first().click();
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

  // The refresh token is the API's HttpOnly cookie and the access token lives in memory
  // (RAA-226): localStorage keeps only the user, and a reload stays signed in by refreshing.
  const stored = await page.evaluate(() => localStorage.getItem("raa.session"));
  expect(Object.keys(JSON.parse(stored))).toEqual(["user"]);
  await page.reload();
  await expect(page.getByTestId("guest-dashboard")).toBeVisible();
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
  // The dashboard's figures come from the API, and a new partner's setup is what needs them
  // (RAA-284): no business or payout account yet. (Its ID check isn't asserted: a local stack
  // with SKIP_ID_CHECK approves it on the first look.)
  await expect(page.getByTestId("dashboard-tile-requests_waiting")).toContainText("0");
  const attention = page.getByTestId("needs-attention");
  await expect(attention.locator('[data-item="business"]')).toBeVisible();
  await expect(attention.locator('[data-item="payout"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your business", exact: true })).toHaveCount(0);

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

  // The partner's tabs link between the partner pages and mark the current one.
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
  for (const tab of ["bookings", "businesses", "earnings"]) {
    await page.getByTestId(`partner-nav-${tab}`).click();
    await expect(page.getByTestId(`partner-${tab}`)).toBeVisible();
  }

  // The sidebar is a rail of icons that opens on hover (RAA-267).
  const sidebar = page.getByTestId("partner-sidebar");
  await page.mouse.move(640, 500);
  await expect(sidebar).toHaveCSS("width", "44px");
  await sidebar.hover();
  await expect(sidebar).toHaveCSS("width", "176px");
  await page.mouse.move(640, 500);
  await expect(sidebar).toHaveCSS("width", "44px");

  // On a phone the tabs move to the window's foot, the rest under More.
  const desktop = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("partner-sidebar")).toBeHidden();
  await page.getByTestId("partner-bar-calendar").click();
  await expect(page.getByTestId("partner-calendar")).toBeVisible();
  await page.getByTestId("partner-bar-more").click();
  await page.getByTestId("partner-more-inbox").click();
  await expect(page.getByTestId("partner-inbox")).toBeVisible();
  await page.setViewportSize(desktop);

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

// The water activity wizard (RAA-272): a verified sample partner (development seeds, which the
// smoke stack runs) lists a jet ski with two rates, a life vest, a drone shot add-on and two
// drop-off zones, then finds them all on its edit page. The pin comes from "Use my location"
// with an emulated position on Bantayan, so the test never clicks the map.
test("water activity wizard", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    baseURL,
    geolocation: { latitude: 11.172, longitude: 123.801 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  const errors = [];
  collectErrors(page, errors);

  // Sent before the page's JavaScript runs, the form posts itself and stays on the sign-in page
  // (RAA-269): try again once it has.
  await expect(async () => {
    await page.goto("/partner/login");
    await page.getByLabel("Email").fill("kota-beach-boat-tours@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/partner\/dashboard$/, { timeout: 20_000 });
  }).toPass({ timeout: 60_000 });

  await page.goto("/partner/listings/new?group=Water%20activities");
  await page.getByTestId("listing-category-next").click();
  await expect(page).toHaveURL(/\/partner\/listings\/new\/type/);
  await page.getByRole("radio", { name: /Jet ski/ }).check();
  await page.getByTestId("listing-type-next").click();

  const wizard = page.getByTestId("activity-wizard");
  await expect(wizard).toBeVisible();
  const next = () => page.getByTestId("listing-next").click();
  await wizard.getByLabel("Title").fill(`Smoke jet ski ${Date.now()}`);
  await next();

  // The jet ski itself (RAA-273): brand, model, engine, its seats and a feature.
  await expect(page.getByTestId("listing-jet-ski")).toBeVisible();
  await page.getByTestId("jet-ski-brand").fill("Yamaha");
  await page.getByTestId("jet-ski-model").fill("VX Cruiser");
  await page.getByTestId("jet-ski-engine").fill("1049");
  await page.getByTestId("jet-ski-feature-reverse_gear").check();
  await next();

  await expect(page.getByTestId("listing-step-meeting")).toBeVisible();
  const same = wizard.getByLabel(/^Same as /);
  if ((await same.count()) && (await same.isChecked())) await same.uncheck();
  await wizard.getByRole("combobox", { name: "Region" }).fill("central vis");
  await page.getByRole("option", { name: "Central Visayas" }).click();
  await wizard.getByRole("combobox", { name: "Province" }).fill("Cebu");
  await page.getByRole("option", { name: "Cebu", exact: true }).click();
  await wizard.getByRole("combobox", { name: "City / Municipality" }).fill("Santa Fe");
  await page.getByRole("option", { name: "Santa Fe" }).first().click();
  await wizard.getByLabel("Street").fill("Kota Beach");
  await page.getByTestId("use-my-location").click();
  await next();

  // How it runs: the jet ski's defaults (per unit, 8:00 to 17:00).
  await expect(page.getByTestId("activity-runs")).toBeVisible();
  await next();

  // Pricing, laid out as a vehicle's: the defaults' three lengths come without prices; keep two.
  const offers = page.getByTestId("activity-offer");
  await expect(offers).toHaveCount(3);
  await expect(offers.nth(0).getByTestId("activity-offer-minutes")).toHaveValue("15");
  await offers.nth(2).getByTestId("activity-offer-remove").click();
  await expect(offers).toHaveCount(2);
  await offers.nth(0).getByTestId("activity-offer-price").fill("1500");
  await offers.nth(1).getByTestId("activity-offer-price").fill("2500");
  // Drop-off by distance, beside the shop pick-up that is always offered.
  await page.getByTestId("activity-drop-off-on").check();
  await page.getByTestId("pricing-zone-add").click();
  await page.getByTestId("pricing-zone").nth(1).getByTestId("pricing-zone-fee").fill("300");
  // An add-on is added like a vehicle's common fee.
  await page.getByTestId("activity-add-on-preset-drone_shot").click();
  await page.getByTestId("activity-add-on-drone_shot").getByTestId("activity-add-on-price").fill("500");
  await next();

  await expect(page.getByTestId("activity-inclusion-life_vest")).toBeChecked();
  await next(); // units
  await next(); // cancellation policy
  await next(); // review

  const review = page.getByTestId("activity-review");
  await expect(review).toContainText("15 minutes: ₱1,500, up to 2 riders");
  await expect(review).toContainText("Drone shot ₱500");
  await expect(review).toContainText("Yamaha VX Cruiser · 1049 cc");
  await expect(review).toContainText("Reverse gear");
  await page.getByTestId("listing-save").click();
  await expect(page.getByTestId("listing-step-photos")).toBeVisible();
  await page.getByTestId("listing-photos-next").click();
  await page.getByTestId("listing-booking-next").click();
  await page.getByTestId("listing-save-draft").click();
  // These pages may compile on first use on a dev server.
  await expect(page).toHaveURL(/\/partner\/listings\/\d+$/, { timeout: 45_000 });

  // The edit page holds what the wizard saved.
  await page.getByRole("link", { name: "Edit listing" }).click();
  await expect(page).toHaveURL(/\/partner\/listings\/\d+\/edit$/, { timeout: 45_000 });
  const editOffers = page.getByTestId("listing-activity-pricing").getByTestId("activity-offer");
  await expect(editOffers).toHaveCount(2, { timeout: 30_000 });
  await expect(editOffers.nth(1).getByTestId("activity-offer-price")).toHaveValue("2500");
  await expect(page.getByTestId("activity-inclusion-life_vest")).toBeChecked();
  await expect(page.getByTestId("activity-add-on-drone_shot").getByTestId("activity-add-on-price")).toHaveValue("500");
  await expect(page.getByTestId("pricing-zone")).toHaveCount(2);
  await expect(page.getByTestId("jet-ski-model")).toHaveValue("VX Cruiser");
  await expect(page.getByTestId("jet-ski-feature-reverse_gear")).toBeChecked();
  expect(errors).toEqual([]);
  await context.close();
});

// Gear rents like a vehicle, by the count (RAA-255): a card's See details opens the gear's page,
// whose business link opens the shop's sheet, with a pickup time and no seats to fill, and what
// is picked goes straight into a new trip.
test("rent gear from a shop's sheet", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = [];
  collectErrors(page, errors);
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  // A different stretch each run, so bookings left by earlier runs don't fill these days.
  const offset = 30 + (Math.floor(Date.now() / 1000) % 240);

  await page.goto(`/bantayan-island/book?from=${day(offset)}&to=${day(offset + 2)}&guests=2&show=need-gear`);
  const [shop] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("business-details").first().click()]);
  collectErrors(shop, errors);
  await expect(shop).toHaveURL(/\/listings\/\d+-[a-z0-9-]+\?/);
  await shop.getByTestId("listing-business").click();
  await expect(shop).toHaveURL(/\/businesses\/\d+\?/);
  const gear = shop.locator("#need-gear");
  await expect(gear.getByTestId("shop-options")).toBeVisible();
  await expect(gear.getByTestId("shop-seats")).toHaveCount(0);
  await expect(gear.getByTestId("shop-model").first()).toBeVisible();
  await gear.locator(`[data-testid^="shop-model-"][data-testid$="-more"]`).first().click();
  await expect(gear.getByTestId("shop-add")).toHaveText(/Add 1 to trip/);
  await expect(gear.getByTestId("shop-summary")).toContainText("₱");
  await gear.getByTestId("shop-add").click();
  await expect(shop.getByTestId("trip-added")).toContainText("Added");
  await shop.goto("/cart");
  await expect(shop.getByText("Qty 1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

// Add to trip (RAA-66): signed out, the first add needs no account (RAA-177). With a trip,
// the next add goes to the trip the banner shows, a centred badge confirms it, and in the cart
// (renamed there) the item left is booked (RAA-133) after the guest gives their contact details; the trip link and
// PIN that come back open the cart in a fresh browser.
test("add to trip without an account", async ({ page, browser }) => {
  // The add, the cart, checkout, the trip link and the Trips page: more than the default 30s.
  test.setTimeout(150_000);
  const errors = [];
  collectErrors(page, errors);
  const stamp = Date.now();
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  // A different stretch each run, so bookings left by earlier runs don't fill these days.
  const offset = 30 + (Math.floor(stamp / 1000) % 240);
  const from = day(offset);
  const to = day(offset + 2);

  // A place's cards all say See details: the adds happen on the listing's page. Opened in this
  // tab, as on a phone, so the trip the first add starts stays the one this tab works on.
  const place = `/bantayan-island?from=${from}&to=${to}&guests=2`;
  // With nothing saved yet the closing band offers the two ways in, not an empty trip.
  await page.goto(place);
  await expect(page.getByTestId("area-trip-band-plan")).toBeVisible();
  await expect(page.getByTestId("area-trip-band-book")).toHaveAttribute("href", /^\/bantayan-island\/book\?/);
  await page.goto(`/bantayan-island/book?from=${from}&to=${to}&guests=2&show=need-activity`);
  const cards = page.getByTestId("business-open");
  const [firstBusiness, secondBusiness] = [await cards.nth(0).getAttribute("href"), await cards.nth(1).getAttribute("href")];
  await page.goto(firstBusiness);
  await page.getByTestId("add-to-trip").first().click();
  // Every add is confirmed in the add sheet, the first one too: it starts a new trip.
  const firstAdd = page.getByTestId("which-trip-sheet");
  await expect(firstAdd.getByTestId("add-sheet-listing")).toBeVisible();
  await expect(firstAdd.getByTestId("add-sheet-trip")).toContainText("New trip");
  await firstAdd.getByTestId("which-trip-add").click();
  await expect(firstAdd).toHaveCount(0);
  // No toast over the page: a centred "Added to trip" badge goes into the header's cart, and a live region says
  // what was added for screen readers.
  const added = page.getByTestId("trip-added");
  await expect(added).toContainText(/Added .+ to Bantayan Island/);
  await expect(page.getByTestId("trip-toast")).toHaveCount(0);
  // The place's page stays the place's: its closing band names the trip, and View trip opens it in the cart.
  await page.goto(place);
  await expect(page.getByTestId("area-trip-band-open")).toHaveAttribute("href", /^\/cart\?trip=\d+$/);

  // From a place's cards the next add goes to the trip the banner shows, with no trip to pick.
  await page.goto(secondBusiness);
  await page.getByTestId("add-to-trip").first().click();
  const whichTrip = page.getByTestId("which-trip-sheet");
  await expect(whichTrip.getByTestId("add-sheet-trip")).toContainText("Bantayan Island");
  // The trip is named after its place and dates, so the button says "your trip", not the island.
  await expect(whichTrip.getByTestId("which-trip-add")).toContainText("Add to your trip");
  await whichTrip.getByTestId("which-trip-add").click();
  await expect(whichTrip).toHaveCount(0);
  await expect(added).toContainText(/Added .+ to Bantayan Island/);

  // The cart (RAA-68, RAA-135): the header counts both items and opens the cart, the trip picked
  // in the trips beside it; it can be renamed there and an item removed.
  await expect(page.getByTestId("nav-cart-count")).toHaveText("2");
  await page.getByTestId("nav-cart").click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByTestId("cart-trip").first().getByTestId("cart-trip-menu").click();
  await page.getByTestId("trip-action-edit").click();
  const edit = page.getByTestId("edit-trip-sheet");
  await edit.getByLabel("Trip name").fill(`Smoke trip ${stamp}`);
  await edit.getByTestId("edit-trip-save").click();
  await expect(edit).toHaveCount(0);
  // One trip: no list of trips beside it, its header carries the new name.
  await expect(page.getByTestId("cart-trip-nav")).toHaveCount(0);
  await expect(page.getByTestId("cart-trip").first()).toContainText(`Smoke trip ${stamp}`);
  const trip = page.getByTestId("cart-trip").filter({ hasText: `Smoke trip ${stamp}` });
  // The trip as the plan reviews it (RAA-305): a row opens the item's panel, which removes it.
  await expect(trip.getByTestId("plan-event").first()).toBeVisible();
  await trip.getByTestId("plan-event-open").first().click();
  await page.getByTestId("cart-item-panel").getByTestId("item-panel-remove").click();
  await page.getByTestId("remove-item-confirm").click();
  await expect(page.getByTestId("cart-toast")).toContainText("Removed");
  await expect(page.getByTestId("nav-cart-count")).toHaveText("1");

  // Checkout (RAA-133): the foot sends every item that can be sent; sending makes a request that
  // waits for its partner (RAA-134), and the cart then shows its booking.
  await trip.getByTestId("cart-checkout").click();
  const checkout = page.getByTestId("checkout-sheet");
  await expect(checkout.getByTestId("checkout-item-price")).toHaveCount(1);
  await expect(checkout.getByTestId("checkout-total")).not.toHaveText("Working out the total…");
  // No account yet: the guest gives the contact details partners see.
  const contact = checkout.getByTestId("checkout-contact");
  await contact.getByLabel("Full name").fill("Smoke Guest");
  await contact.getByLabel("Email").fill(`trip-${stamp}@example.com`);
  await contact.getByLabel("Phone").fill("9171234567");
  await contact.getByTestId("consent").check();
  await checkout.getByTestId("checkout-confirm").click();
  await expect(checkout.getByTestId("checkout-result").getByTestId("booking-status")).toHaveText("Request sent");
  await expect(page.getByTestId("checkout-toast")).toContainText("Request sent to the partner");
  // The trip link and PIN, shown once.
  const tripLink = await checkout.getByTestId("trip-link-url").textContent();
  const pin = await checkout.getByTestId("trip-link-pin").textContent();
  expect(tripLink).toMatch(/\/trips\/open\/[\w-]+$/);
  expect(pin).toMatch(/^\d{6}$/);
  await checkout.getByRole("button", { name: "Done" }).click();
  await expect(trip.getByTestId("plan-event").getByTestId("booking-status").first()).toHaveText("Request sent");
  await expect(trip.getByTestId("cart-checkout")).toHaveCount(0);

  // The item's panel (RAA-135) shows its booking, and editing it sends the change to the partner.
  await trip.getByTestId("plan-event-open").first().click();
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
  await expect(booked.getByTestId("plan-day").first()).toBeVisible();
  await expect(booked.getByTestId("plan-event").getByTestId("booking-status").first()).toHaveText("Request sent");

  // Past and Cancelled are tabs over the sidebar; nothing is past or cancelled yet.
  await page.getByTestId("trips-tab-past").click();
  await expect(page.getByTestId("trips-past-empty")).toBeVisible();
  await expect(booked).toHaveCount(0);
  await page.getByTestId("trips-tab-cancelled").click();
  await expect(page.getByTestId("past-bookings-empty")).toBeVisible();
  await page.getByTestId("trips-tab-upcoming").click();
  await expect(booked).toBeVisible();

  // A share link (RAA-178) opens a view-only page with no prices in a fresh browser, and is
  // not found once sharing stops. That context's console isn't collected: the 404 is expected.
  await page.goto("/cart");
  await page.getByTestId("cart-trip").filter({ hasText: `Smoke trip ${stamp}` }).getByTestId("cart-share").click();
  const shareSheet = page.getByTestId("share-trip-sheet");
  await shareSheet.getByTestId("share-trip-create").click();
  const shareUrl = new URL(await shareSheet.getByTestId("share-trip-url").textContent());
  const friends = await browser.newContext();
  const friend = await friends.newPage();
  await friend.goto(shareUrl.pathname);
  await expect(friend.getByTestId("shared-trip-name")).toHaveText(`Smoke trip ${stamp}`);
  await expect(friend.getByTestId("shared-trip-items").getByTestId("booking-status")).toHaveText("Request sent");
  // Its plan day by day, read-only: Getting here, but no way to find a transfer.
  await expect(friend.getByTestId("plan-day").first()).toBeVisible();
  await expect(friend.getByTestId("plan-getting-here")).toBeVisible();
  await expect(friend.getByTestId("plan-days").getByRole("button")).toHaveCount(0);
  await expect(friend.getByText("₱")).toHaveCount(0);
  await shareSheet.getByTestId("share-trip-stop").click();
  await expect(shareSheet.getByTestId("share-trip-create")).toBeVisible();
  await friend.reload();
  await expect(friend.getByTestId("shared-trip-missing")).toBeVisible();
  await friends.close();
  await page.keyboard.press("Escape");

  // The trip link in a fresh browser: a wrong PIN is refused, the right one opens the cart.
  const other = await browser.newContext();
  const elsewhere = await other.newPage();
  collectErrors(elsewhere, errors);
  await elsewhere.goto(tripLink);
  const unlock = elsewhere.getByTestId("trip-link-unlock");
  await unlock.getByLabel("PIN").fill(pin === "000000" ? "111111" : "000000");
  await unlock.getByTestId("trip-link-open").click();
  await expect(unlock.getByTestId("trip-link-error")).toBeVisible();
  // The wrong PIN's 401 is the one console error expected here.
  errors.splice(errors.findIndex((error) => error.includes("401")), 1);
  await unlock.getByLabel("PIN").fill(pin);
  await unlock.getByTestId("trip-link-open").click();
  await expect(elsewhere).toHaveURL(/\/cart$/);
  await expect(elsewhere.getByTestId("cart-trip").filter({ hasText: `Smoke trip ${stamp}` })).toBeVisible();
  await other.close();

  expect(errors).toEqual([]);
});

// A business's shop page (RAA-281): a sample partner sets its opening hours, a language and a
// question on its business, and a guest finds them on the business's page. The sample businesses
// have no address yet, which the form requires, so it gets one (and its pin from "Use my
// location", as in the water activity wizard).
test("business settings and shop page", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    baseURL,
    geolocation: { latitude: 11.172, longitude: 123.801 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  const errors = [];
  collectErrors(page, errors);

  await expect(async () => {
    await page.goto("/partner/login");
    await page.getByLabel("Email").fill("kota-beach-boat-tours@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/partner\/dashboard$/, { timeout: 20_000 });
  }).toPass({ timeout: 60_000 });

  await page.goto("/partner/listings");
  await page.getByTestId("business-edit").first().click();
  await expect(page).toHaveURL(/\/partner\/businesses\/\d+\/edit$/, { timeout: 20_000 });
  const id = page.url().match(/businesses\/(\d+)\/edit/)[1];
  const form = page.getByTestId("business-form");
  await expect(form).toBeVisible({ timeout: 20_000 });

  if (!(await form.getByLabel("Street").inputValue())) {
    await form.getByRole("combobox", { name: "Region" }).fill("central vis");
    await page.getByRole("option", { name: "Central Visayas" }).click();
    await form.getByRole("combobox", { name: "Province" }).fill("Cebu");
    await page.getByRole("option", { name: "Cebu", exact: true }).click();
    await form.getByRole("combobox", { name: "City / Municipality" }).fill("Santa Fe");
    await page.getByRole("option", { name: "Santa Fe" }).first().click();
    await form.getByLabel("Street").fill("Kota Beach");
    await page.getByTestId("use-my-location").click();
  }

  const hours = page.getByTestId("business-hours-on");
  if (!(await hours.isChecked())) await hours.check();
  await page.getByTestId("business-opens-at").selectOption("07:00");
  await page.getByTestId("business-closes-at").selectOption("21:00");
  const english = page.getByTestId("business-languages").getByLabel("English");
  if (!(await english.isChecked())) await english.check();
  const question = `Is the boat covered? ${Date.now()}`;
  await page.getByTestId("business-faq-add").click();
  await form.getByLabel(/^Question \d+$/).last().fill(question);
  await form.getByLabel("Answer").last().fill("Yes, there is a shade over the deck.");
  await page.getByTestId("business-save").click();
  await expect(page).toHaveURL(/\/partner\/listings$/, { timeout: 20_000 });

  const guest = await context.newPage();
  collectErrors(guest, errors);
  await guest.goto(`/businesses/${id}`);
  await expect(guest.getByTestId("business-trust")).toContainText("English");
  await expect(guest.getByTestId("business-where")).toContainText("7:00 AM – 9:00 PM");
  const goodToKnow = guest.getByTestId("business-good-to-know");
  await goodToKnow.getByText(question).click();
  await expect(goodToKnow).toContainText("Yes, there is a shade over the deck.");
  await expect(guest.getByTestId("business-options-list")).toBeVisible();
  await context.close();

  expect(errors).toEqual([]);
});
