#!/usr/bin/env bash
# PostToolUse hook for Edit/Write: after a web TypeScript file changes, runs ESLint on it
# in the running web container and feeds any problem back to Claude (exit 2). Does nothing
# when the stack is down — script/check frontend runs ESLint anyway.
set -uo pipefail

command -v jq >/dev/null || exit 0

input="$(cat)"
path="$(jq -r '.tool_input.file_path // empty' <<<"$input")"
cwd="$(jq -r '.cwd // empty' <<<"$input")"
[[ "$path" == /* ]] || path="${cwd:-$PWD}/$path"

case "$path" in
  */web/src/api/schema.d.ts) exit 0 ;;
  */web/*.ts|*/web/*.tsx|*/web/*.mjs) ;;
  *) exit 0 ;;
esac
case "$path" in */node_modules/*|*/.next/*) exit 0 ;; esac
[[ -f "$path" ]] || exit 0

# The checkout the edit happened in: a worktree has its own stack.
root="$(git -C "$(dirname "$path")" rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$root" ]] || exit 0
cd "$root" || exit 0
[[ -n "$(docker compose ps -q --status running web 2>/dev/null)" ]] || exit 0

relative="${path#"$root"/web/}"
output="$(docker compose exec -T web npx eslint --format compact "$relative" 2>&1)" || {
  echo "eslint: web/$relative" >&2
  echo "$output" >&2
  exit 2
}
exit 0
