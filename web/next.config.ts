import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { NextConfig } from "next";

// MapLibre runs its tile work in a web worker that it looks for next to its own module, which
// the bundler moves; so the worker is copied to public/ and served from there (see
// MAPLIBRE_WORKER_URL in src/lib/map.ts). This file loads on every dev and build, unlike npm's
// pre-hooks, which `npx next build` skips.
const maplibreDist = path.join(path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")), "dist");
mkdirSync("public/maplibre", { recursive: true });
copyFileSync(path.join(maplibreDist, "maplibre-gl-worker.mjs"), "public/maplibre/maplibre-gl-worker.mjs");

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
