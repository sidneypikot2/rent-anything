// Smoke test for the running Compose stack. Run through script/smoke, which starts the
// stack and runs this in the Playwright container.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // script/smoke "<name>": only the tests whose name matches.
  ...(process.env.SMOKE_GREP ? { grep: new RegExp(process.env.SMOKE_GREP) } : {}),
  globalSetup: "./global-setup.js",
  // One worker: a smoke test should be boring.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: `http://localhost:${process.env.FRONTEND_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
