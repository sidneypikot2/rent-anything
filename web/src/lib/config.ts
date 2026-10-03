// Where the Rails API is. Two cases:
// - Server-side (Server Components, Route Handlers): API_INTERNAL_URL — inside Docker the
//   browser's localhost isn't the backend, so Compose sets http://backend:3000.
// - Browser: NEXT_PUBLIC_API_URL when set (production), otherwise derived from the page's
//   own port: web 8100+N talks to backend 3100+N, the offset script/worktree-env gives a
//   worktree stack (see docker-compose.yml).
const WEB_BASE_PORT = 8100;
const API_BASE_PORT = 3100;

export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? `http://localhost:${API_BASE_PORT}`;
  }
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  const { protocol, hostname, port } = window.location;
  const offset = Number(port) - WEB_BASE_PORT;
  const apiPort = offset >= 0 && offset <= 30 ? API_BASE_PORT + offset : API_BASE_PORT;
  return `${protocol}//${hostname}:${apiPort}`;
}
