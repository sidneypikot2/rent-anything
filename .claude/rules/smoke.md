---
paths:
  - "tools/smoke/**"
---

# Smoke tests

**A long test sets its own timeout**: the config gives each test 30 s (`tools/smoke/playwright.config.js`), and CI is slower than a laptop. A test that visits many pages or walks a long flow sets `test.setTimeout(...)`, as the long tests in `tools/smoke/tests/smoke.spec.js` do. "One h1 per page" took 19–32 s on CI and failed until it had one (RAA-231).
