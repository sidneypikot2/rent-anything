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

const nextConfig: NextConfig = {
  // The hosted image (web/Dockerfile) runs the minimal server.js from .next/standalone.
  // `next dev` ignores it.
  output: "standalone",
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
