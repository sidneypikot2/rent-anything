---
name: verify-app
description: Run Rent-Anything locally and prove a change works in the real app - start the Docker stack, seed the dev test accounts, drive the web app in Chrome (renter, owner and admin views), capture screenshots and post them to the Jira ticket.
argument-hint: "<RAA-n> <what to verify>"
disable-model-invocation: true
context: fork
agent: general-purpose
background: false
---

# Verify the app

This skill runs in a subagent, so the screenshots it takes never enter the session that
asked for it. You have not seen that session's conversation: everything you know about the
task is below and in the Jira ticket (project and cloudId are in `CLAUDE.md`; the ticket's
description ends with its `Discord thread:`, `Branch:` and `PR:` lines).

Verify: $ARGUMENTS

```!
git branch --show-current
git diff --stat origin/staging...HEAD
```

If nothing above says what to verify, verify what the diff changes, and say that is what
you did. With no ticket key, skip the Jira and Discord steps and say so.

`script/smoke` already proves the basics automatically — the web app loads without
script errors and reaches the API (`tools/smoke/tests/`). Run it first; if it fails, fix
that before opening a browser. This skill is for what the smoke test doesn't walk
through: the specific change, as the user sees it.

## 1. Start the stack

```bash
docker compose up -d
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/up   # expect 200
```

| What | URL |
|------|-----|
| Web app | http://localhost:8100 |
| Backend API | http://localhost:3100 (OpenAPI document at `/api-docs/v1/openapi.yaml`) |

**In a git worktree** the stack runs on its own ports: run `script/worktree-env` first (it
prints the URLs — web `8100+N`, backend `3100+N`) and use those everywhere this skill
says 8100 / 3100.

After backend changes or a branch switch: `docker compose restart backend` (re-runs
`db:prepare`, so pending migrations apply). The web container runs `next dev`, which
reloads on file changes; restart it (`docker compose restart web`) after a dependency
change.

## 2. Test data

Once sign-up exists (M1), test accounts come from the development seeds
(`docker compose exec -T -e RAILS_ENV=development backend bin/rails db:seed`): a renter, an
owner with a Moalboal listing, and an admin. The seed file is the source of truth for
their emails and password. Use these, never the user's real accounts. If the seeds don't
cover what you need to verify, say so rather than creating data by hand.

`docker compose exec` needs `-e RAILS_ENV=development`: the backend service sets it inline
in `command:`, not in `environment:`, so exec'd processes don't inherit it.

## 3. Drive it in Chrome

1. Open `http://localhost:8100` in a new tab.
2. For anything involving two roles (a renter books, the owner accepts), use one tab per
   role in separate windows or profiles, and sign in one at a time. Use one tab as the
   actor and the other as the observer when clicks in the second tab don't register.
3. Exercise the change the way a user would, including the unhappy path (empty input,
   very long text, unavailable dates, the other role's view, a phone-width window).
4. Read the browser console in each tab — a feature that renders but logs errors is not
   verified.

### Screenshot budget

Screenshots are the most expensive part of a verification run. Keep them few and small:

- **Working screenshots at half scale** (`scale: 0.5`), and only when you need to see the
  page to decide the next action. Aim for five or fewer per run.
- **Full-size, saved to disk only for proof** — one per thing being proven, normally one
  or two per task (`save_to_disk: true`).
- **Prefer text over pixels**: use `find` / `read_page` to locate elements and confirm
  text, and `read_console_messages` for errors, instead of taking a screenshot to look.
- **Batch actions** (`browser_batch`) with a single screenshot at the end, not one after
  every click.
- **Check backend behaviour through the API**, not the browser: `curl` the endpoint. Use
  the browser only for what the user actually sees.
- **Stop after two failed attempts** at the same click or step. Don't keep re-screenshotting;
  switch approach (element ref, actor/observer swap, API check) or report it as unverified.

## 4. Capture and post proof

- Save screenshots to disk with descriptive names: `RAA-<n>-<what>.jpg`
  (e.g. `RAA-12-area-cart.jpg`).
- Jira: comment on the ticket with a short summary of what was verified and the
  screenshot embedded inline. The Atlassian server's operation names change between
  versions, so find the attachment-upload operation with its `discover` tool rather than
  from memory. Embed the file once — don't also attach it to the issue separately. If the
  upload can't be done, say so and give the screenshot paths instead.
- Discord: one line in the task's thread saying what was verified, pointing at the ticket.
  Don't re-upload the screenshots there.
- Do this when the PR is opened and the ticket moves to In Review.

## Return

Your final message is all the calling session gets. Make it text only: what was exercised
and what was seen, any console errors, the paths of the saved screenshots, and the link to
the Jira comment. Don't read the saved screenshots back or attach them. If something
couldn't be verified (Chrome unavailable, a payment flow that needs gateway test keys),
say so rather than implying it was checked.
