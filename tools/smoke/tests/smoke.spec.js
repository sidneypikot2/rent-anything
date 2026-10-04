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
  await expect(page.getByTestId("guest-signup")).toBeVisible();

  expect(errors).toEqual([]);
});

// The partner and admin entry points render with their own forms, and the UI kit page
// renders every component.
for (const [path, heading, testId] of [
  ["/partner", "List with Rent-Anything", "partner-signup"],
  ["/admin", "Admin console", "admin-signin"],
  ["/admin/ui-kit", "Tidal Grove", "ui-kit"],
]) {
  test(`${path} renders`, async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await expect(page.getByTestId(testId)).toBeVisible();

    expect(errors).toEqual([]);
  });
}
