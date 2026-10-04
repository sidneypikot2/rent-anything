---
paths:
  - "docker-compose.yml"
  - ".github/**"
  - "script/**"
  - "tools/**"
  - ".githooks/**"
  - ".claude/hooks/**"
  - ".claude/settings.json"
  - ".claude/cloud-setup.sh"
  - ".mcp.json"
  - ".worktreeinclude"
---

# Infra and tooling conventions

Several of these files depend on each other in ways nothing checks. Change them together.

**Ports.** The main stack runs on 8100 (web), 3100 (backend), 5532 (db), 6479 (redis) — not PikotChat's 8080/3000/5432/6379, so both projects can run at once. A worktree stack adds an offset N (1–30): `script/worktree-env` picks N and writes `.env`, `docker-compose.yml` reads `FRONTEND_PORT` / `BACKEND_PORT` / `DB_PORT` / `REDIS_PORT` from it, and `web/src/lib/config.ts` derives the backend port from the page's own port with the same offset. Changing a default port or the offset range means changing all three, plus `script/smoke` and `.claude/skills/verify-app/SKILL.md`.

**Two protected branches.** Task PRs merge into `staging` (GitHub's default branch); `main` only receives `staging` through a release PR titled `Release <YYYY-MM-DD>` (`/release`), merged with a merge commit so `staging` stays an ancestor of `main`. The repository allows merge commits only (squash and rebase are off in its settings): task PRs need them too, because `/raa-finish` (`git branch -d`) and `script/docker-sweep` tell a merged branch by ancestry, which a squash merge breaks. `staging`'s protection requires a branch to be up to date before it merges, so two PRs that pass separately can't break it together; `main`'s doesn't, because after a release `main` has a merge commit `staging` never gets. `.githooks/`, `guard-bash.sh`, `pr-conventions.yml`, `ci.yml` (`push` branches), `dependabot.yml` (`target-branch`), `script/docker-sweep`, `script/test-hooks`, the session hooks (`env-check.sh`, `git-hooks.sh`, `guard-edit.sh`) and the `raa-task`, `raa-finish`, `release` and `verify-app` skills each name the branches — a change to the branch model touches all of them.

**CI job names are branch-protection settings.** `main` and `staging` both require the checks `scan_ruby`, `lint`, `frontend`, `test`, `tooling`, `smoke` and `conventions` by name. Renaming or removing one of those jobs leaves a required check that never reports, and nothing can merge — tell the user to update branch protection in the same change. A new job is not required until it is added there.

**One definition of each check.** CI calls `script/check <area>` and `script/smoke`; don't add a check to the workflow that the scripts don't run, or to a script without it running in CI. The rspec, rubocop and eslint commands are written only in `script/test` and `script/lint` — instruction files, skills and the permission allowlist name the scripts, never the raw commands. Scripts work from any directory (`cd "$(dirname "$0")/.."`), need only Docker and `jq`, and say `name: ok` or list every problem and exit 1; shared helpers are in `script/lib.sh`.

**Instruction files are checked.** `script/check-docs` (part of `script/check tooling`) fails on a path in `CLAUDE.md`, a rule, a skill or an agent that doesn't exist, on a rule `paths:` pattern that matches no file, and on a `CLAUDE.md` over 100 lines. It also checks the Claude Code config, which Claude Code skips quietly when it can't use it: `settings.json` and `.mcp.json` parse, every hook event is known and every hook script exists, is executable and is wired to an event, `Bash(script/…)` allow rules name real scripts, and agent and skill names are kebab-case and match their file or directory (a new hook event goes in its list). Moving or renaming a file means updating the instruction files that name it in the same change. `script/scan-secrets` (same check) runs gitleaks over the history; a false positive goes in `.gitleaksignore` by fingerprint.

**A check must not depend on gitignored files** (`backend/.env`, `node_modules`, a worktree's `.env`): CI has none of them, so the check passes here and fails there. Run a new check in a fresh clone before pushing it.

**Session hooks.** `git-hooks.sh` enables `.githooks/`; `env-check.sh` prints the environment line local sessions start with (missing tools, stack state, leftovers); `rubocop.sh` and `eslint.sh` run after edits; `worktree-remove.sh` stops a worktree's Docker stack when Claude Code removes the worktree. A session-start hook never fails the session and stays fast, with no network calls — it runs on every start, resume and `/clear` (the workflow clears between tasks, so a hook that skipped `clear` would miss the sessions that start them). `env-check.sh` also warns when the main checkout isn't on an up-to-date `staging`, since the hooks run from there — except on an `<area>/raa-<n>-…` task branch, where a task without a migration is branched in place. `script/docker-sweep` reports stacks whose worktree is gone and only deletes with `--apply`; it never touches the main stack.

**Guards.** `.claude/hooks/guard-bash.sh` and `guard-edit.sh` are fast feedback on command text; `.githooks/` and branch protection are what actually hold. `core.hooksPath` may be the relative `.githooks` or an absolute path to the main checkout's copy (Claude Code rewrites it when it creates a worktree) — both are valid. Every rule has a case in `script/test-hooks` — add the case first and watch it fail. When narrowing a rule to stop a false positive, first add block cases for the forms the old rule caught — for a path rule: the path in quotes or followed by a closing quote, `;` or `&&` with no space, a glob or brace, a backtick, inside an `sh -c` or `ssh` string. These pass before the change and must still pass after it, so the narrower rule can't quietly let them through. Hooks run from the main checkout (`$CLAUDE_PROJECT_DIR`), even in a worktree session, so a change to a hook takes effect only after it is merged and that checkout (normally on `staging`) is updated; test it through `script/test-hooks`, not by trying it live. That is why a task changing hooks, `.githooks/` or `settings.json` works in a worktree, never branched in place (`/raa-task` step 3). Keep them bash 3.2 compatible (macOS) and shellcheck-clean (`script/lint-shell`). Don't grow `guard-bash.sh` beyond what it covers now — commands that destroy local work or the development database, turn off the git hooks, name a secret file, or write a generated or encrypted file: a text guard can always be worded around, so anything else that must hold goes in `.githooks/`, branch protection or CI.

**Permissions** (`.claude/settings.json`): file rules are `Read(...)` and `Edit(...)` only — a `Write(...)` path rule is never consulted. Claude Code splits a compound command and applies a Bash deny rule to each part, including subshells and common wrappers, but it still matches text: the same program run another way (by path, from a script, inside `docker compose exec`) gets through. Anything that must hold whatever the wording goes in a git hook, branch protection or CI; the deny rules and `guard-bash.sh` are a fast first line.

**Pinned pairs.** The Playwright image tag in `docker-compose.yml` must equal `@playwright/test` in `tools/smoke/package.json`. `backend/.ruby-version`, `backend/Dockerfile` and the Ruby version in `CLAUDE.md` move together; so do the Node major in `docker-compose.yml` (`node:24-alpine`) and `CLAUDE.md` (CI runs Node only in that container). `web/` and `tools/smoke/` have lockfiles; their `node_modules` are gitignored and installed inside the containers (the web container keeps them in the `web_node_modules` volume).

**Compose.** Don't put `RAILS_ENV` in the backend's `environment:` block (see `CLAUDE.md`). A service that isn't part of the app goes behind a `profiles:` entry, like `smoke`, so `docker compose up` stays four services. The db image is imresamu/postgis (multi-arch); the official postgis/postgis image is amd64-only and crawls under emulation on Apple silicon.

**Workflows.** Never interpolate `${{ github.event.* }}` text into a `run:` script — pass it through `env:` (a PR title is untrusted input). Read PR titles and labels from the API, not the event payload: the `opened` event is sent before labels are attached.

**Cloud sessions.** `.claude/cloud-setup.sh` runs once per environment and its filesystem is cached, so it must finish in about five minutes and can't leave anything running; `.claude/hooks/cloud-start.sh` starts services on every session. User-level settings, plugins and Discord don't exist there.
