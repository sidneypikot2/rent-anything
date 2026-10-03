#!/usr/bin/env bash
# Shared by the scripts in this directory; source it after cd-ing to the repo root.
#   source script/lib.sh

# True in a linked git worktree (not the main checkout).
in_linked_worktree() {
  [[ "$(git rev-parse --path-format=absolute --git-dir)" != "$(git rev-parse --path-format=absolute --git-common-dir)" ]]
}

# A worktree's stack needs its own ports and project name before the first compose call.
ensure_worktree_env() {
  if in_linked_worktree && [[ ! -f .env ]]; then
    script/worktree-env >/dev/null
  fi
}

backend_running() {
  [[ -n "$(docker compose ps -q --status running backend 2>/dev/null)" ]]
}

# Runs a command in the backend image: inside the running container when the stack is up
# (fast), in a one-off container otherwise. The first argument is the RAILS_ENV to use,
# or "-" to leave it alone.
backend_do() {
  local rails_env="$1"; shift
  local env_args=()
  [[ "$rails_env" != "-" ]] && env_args=(-e "RAILS_ENV=$rails_env")
  if backend_running; then
    docker compose exec -T ${env_args[@]+"${env_args[@]}"} backend "$@"
  else
    docker compose run --rm ${env_args[@]+"${env_args[@]}"} backend "$@"
  fi
}

web_running() {
  [[ -n "$(docker compose ps -q --status running web 2>/dev/null)" ]]
}

# Runs a command in the web (Node) container: inside the running container when the stack
# is up, in a one-off container otherwise — installing web/node_modules into its volume
# first when the lockfile changed, the same way the service's own command does.
web_do() {
  if web_running; then
    docker compose exec -T web "$@"
  else
    # shellcheck disable=SC2016  # $@ is expanded by the container's shell
    docker compose run --rm --no-deps -T web sh -c \
      'cmp -s package-lock.json node_modules/.installed-lock 2>/dev/null \
        || { npm ci --no-audit --no-fund --silent && cp package-lock.json node_modules/.installed-lock; } \
        && exec "$@"' sh "$@"
  fi
}
