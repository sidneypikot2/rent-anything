// Where the Rails API is. Two cases:
// - Server-side (Server Components, Route Handlers): API_INTERNAL_URL — inside Docker the
//   browser's localhost isn't the backend, so Compose sets http://backend:3000.
// - Browser: NEXT_PUBLIC_API_URL when set (production), otherwise derived from the page's
//   own port: web 8100+N talks to backend 3100+N and WebSockets 8200+N, the offset
//   script/worktree-env gives a worktree stack (see docker-compose.yml).
const WEB_BASE_PORT = 8100;
const API_BASE_PORT = 3100;
const CABLE_BASE_PORT = 8200;

// The page's own port offset from 8100 (0 off a worktree stack or behind a proxy).
function portOffset(port: string): number {
  const offset = Number(port) - WEB_BASE_PORT;
  return offset >= 0 && offset <= 30 ? offset : 0;
}

export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? `http://localhost:${API_BASE_PORT}`;
  }
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  const { protocol, hostname, port } = window.location;
  return `${protocol}//${hostname}:${API_BASE_PORT + portOffset(port)}`;
}

// The WebSocket server (anycable, RAA-201), browser only. Deployed, it is the API host's
// /cable (Caddy sends it on, RAA-202); locally its own port, 8200+N.
export function cableUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws").replace(/\/$/, "")}/cable`;
  }
  const { protocol, hostname, port } = window.location;
  const scheme = protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${hostname}:${CABLE_BASE_PORT + portOffset(port)}/cable`;
}

// The site's own public origin (RAA-249), for anything that needs an absolute URL: the
// sitemap, robots.txt, metadataBase (canonical, Open Graph) and JSON-LD. NEXT_PUBLIC_SITE_URL
// is a build arg (web/Dockerfile), https://staging.tripkonext.com on staging; locally the main
// stack's address. No trailing slash.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8100").replace(/\/+$/, "");
}

// An absolute URL on this site for a path ("/about" → "https://…/about").
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

// Whether search engines may index this deployment (RAA-247). Only a deployment built with
// NEXT_PUBLIC_SITE_INDEXABLE=true is (production, once it exists): staging sets it to false,
// and anything that leaves it out (local stacks, CI) is kept out too, so a missing setting
// can never put a test site in the index. Decided by this flag, never by the hostname.
export function siteIndexable(): boolean {
  return process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true";
}
