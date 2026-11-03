import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// MapLibre runs its tile work in a web worker that it looks for next to its own module, which
// the bundler moves; so the worker is copied to public/ and served from there (see
// MAPLIBRE_WORKER_URL in src/lib/map.ts). This file loads on every dev and build, unlike npm's
// pre-hooks, which `npx next build` skips.
const maplibreDist = path.join(path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")), "dist");
mkdirSync("public/maplibre", { recursive: true });
copyFileSync(path.join(maplibreDist, "maplibre-gl-worker.mjs"), "public/maplibre/maplibre-gl-worker.mjs");

// The Content-Security-Policy (RAA-213). The access and refresh tokens sit in localStorage
// (src/lib/auth/session.ts), so an injected script could take over an account: this limits
// where scripts load from and where the page may send data. Every host comes from a
// build-time value, since NEXT_PUBLIC_* are baked in anyway (web/Dockerfile). A new
// third-party script, API or image host goes on this list (.claude/rules/web.md).
function contentSecurityPolicy() {
  const dev = process.env.NODE_ENV === "development";
  // The API and its WebSocket (src/lib/config.ts). Without NEXT_PUBLIC_API_URL the browser
  // derives them from the page's port (3100+N, 8200+N), so any localhost port.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const api = apiUrl
    ? [new URL(apiUrl).origin, new URL(apiUrl).origin.replace(/^http/, "ws")]
    : ["http://localhost:*", "ws://localhost:*", "http://127.0.0.1:*", "ws://127.0.0.1:*"];
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentry = sentryDsn ? [new URL(sentryDsn).origin] : [];
  // Google sign-in (Google Identity Services) and the Facebook SDK (oauth-buttons.tsx).
  const google = "https://accounts.google.com/gsi/";
  const facebook = ["https://connect.facebook.net", "https://www.facebook.com", "https://web.facebook.com"];

  const directives = {
    "default-src": ["'self'"],
    // Next's bootstrap and RSC payload are inline scripts; a nonce would make every page
    // dynamic. `next dev` also evals (React's call stacks).
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), `${google}client`, "https://connect.facebook.net"],
    "style-src": ["'self'", "'unsafe-inline'", `${google}style`],
    // Photos come from the API (the local stack's disk stand-in) and R2's public URL, which is
    // the backend's setting (R2_PUBLIC_URL), not the web app's: any https image.
    "img-src": ["'self'", "data:", "blob:", "https:", ...(apiUrl ? [] : ["http://localhost:*", "http://127.0.0.1:*"])],
    "font-src": ["'self'", "data:"],
    // Photon (place search), OpenFreeMap (map style, tiles, glyphs), photo uploads PUT
    // straight to R2's S3 endpoint (use-listing-photos.ts).
    "connect-src": [
      "'self'",
      ...api,
      "https://photon.komoot.io",
      "https://tiles.openfreemap.org",
      "https://*.r2.cloudflarestorage.com",
      ...sentry,
      google,
      "https://graph.facebook.com",
      ...facebook,
    ],
    // MapLibre's worker, copied to /maplibre (above).
    "worker-src": ["'self'", "blob:"],
    "frame-src": [google, ...facebook, "https://staticxx.facebook.com"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

const nextConfig: NextConfig = {
  // The hosted image (web/Dockerfile) runs the minimal server.js from .next/standalone.
  // `next dev` ignores it.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The area map and the partner's location picker ask for the visitor's position.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // frame-ancestors 'none' for browsers without CSP level 2.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

// Sentry (src/lib/sentry.ts). With SENTRY_AUTH_TOKEN (deploy-staging.yml passes it as a build
// secret) the build uploads the browser source maps to the "web" project and deletes them from
// the output; without it, as in local builds and CI checks, nothing is uploaded. The release is
// the deployed commit, the same one the API reports.
export default withSentryConfig(nextConfig, {
  org: "tripkonext",
  project: "web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.NEXT_PUBLIC_SENTRY_RELEASE },
  // No token, no source maps: nothing would upload them, so don't build them either.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Upload logs show in the deploy run; local builds stay quiet.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
