#!/usr/bin/env bash
# SessionStart hook (local sessions): reports what is missing on this machine, whether
# the Docker stack is up, where the session is, and leftovers from earlier tasks — so a
# gap shows in the first message instead of halfway through /raa-task. Its output becomes
# context. Never fails the session; cloud sessions have cloud-start.sh instead.
[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

notes=()

command -v jq >/dev/null || notes+=("jq missing: the guard hooks block every command and edit until it is installed (brew install jq)")
if ! command -v gh >/dev/null; then
  notes+=("gh missing: the PR and CI steps of /raa-task won't work (brew install gh, then gh auth login)")
elif ! gh auth token >/dev/null 2>&1; then
  notes+=("gh is not logged in: the PR and CI steps of /raa-task won't work (gh auth login)")
fi

if ! command -v docker >/dev/null; then
  notes+=("docker missing: specs, checks and the app can't run")
elif ! docker info >/dev/null 2>&1; then
  notes+=("Docker isn't running: start Docker Desktop before running specs or script/check")
else
  running="$(docker compose ps -q --status running 2>/dev/null | wc -l | tr -d ' ')"
  if (( running > 0 )); then
    stack="stack up ($running container(s))"
  else
    stack="stack down (docker compose up -d starts it)"
  fi
  leftovers="$(script/docker-sweep --quiet 2>/dev/null || true)"
  [[ -n "$leftovers" ]] && notes+=("$leftovers")
fi

branch="$(git branch --show-current 2>/dev/null || true)"
where="branch ${branch:-(detached)}"
if [[ "$(git rev-parse --path-format=absolute --git-dir 2>/dev/null)" != "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" ]]; then
  where="$where, in worktree ${PWD##*/}"
  [[ -f .env ]] || notes+=("this worktree has no .env yet: run script/worktree-env before the first docker compose command")
fi

# Hooks and guards run from the main checkout ($CLAUDE_PROJECT_DIR) even in a worktree
# session, so it has to sit on an up-to-date staging for merged hook changes to apply.
# Compared with the last fetch only: a session start doesn't touch the network.
main_root="$(git worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | head -n1)"
if [[ -n "$main_root" ]]; then
  main_branch="$(git -C "$main_root" branch --show-current 2>/dev/null || true)"
  if [[ "$main_branch" != "staging" ]]; then
    notes+=("the main checkout is on ${main_branch:-a detached HEAD}, not staging — hooks run from there, so merged hook changes don't apply until it is back on an up-to-date staging. Tell the user (in that checkout, once its tree is clean: git switch staging && git fetch && git merge --ff-only origin/staging); don't switch it yourself")
  elif behind="$(git -C "$main_root" rev-list --count HEAD..origin/staging 2>/dev/null)" && (( behind > 0 )); then
    notes+=("the main checkout's staging is $behind commit(s) behind origin/staging — hooks run from there (git fetch && git merge --ff-only origin/staging in it, if its tree is clean)")
  fi
fi

echo "Environment: $where; ${stack:-Docker unavailable}."
for note in ${notes[@]+"${notes[@]}"}; do
  echo "- $note"
done
exit 0
