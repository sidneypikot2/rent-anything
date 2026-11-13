// The browser must see the app exactly where a person does — http://localhost:<web
// port>, talking to http://localhost:<backend port> — because web/src/lib/config.ts
// derives the API URL from that address and the backend's CORS check only allows it. Inside this container "localhost" is the container itself, so
// forward those ports — and the WebSocket server's (RAA-201) — to the Compose services. Plain TCP, so the WebSocket works too.
import fs from "node:fs";
import net from "node:net";

function forward(port, host, targetPort) {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, host);
    client.pipe(upstream).pipe(client);
    const close = () => { client.destroy(); upstream.destroy(); };
    client.on("error", close);
    upstream.on("error", close);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

export default async function globalSetup() {
  const { FRONTEND_PORT, BACKEND_PORT, CABLE_PORT } = process.env;
  if (!FRONTEND_PORT || !BACKEND_PORT) throw new Error("FRONTEND_PORT and BACKEND_PORT must be set (run through script/smoke)");

  const servers = [
    await forward(Number(FRONTEND_PORT), "web", 8080),
    await forward(Number(BACKEND_PORT), "backend", 3000),
    await forward(Number(CABLE_PORT ?? 8200), "anycable", 8080),
  ];
  await warmRoutes();
  return () => servers.forEach((server) => server.close());
}

// The web container runs `next dev`, which compiles a route on its first request. A click into a
// route nobody has opened yet then waits on that compile — past the 10 s an assertion waits, on a
// slow CI runner — so every page is requested once here, before any test (RAA-318). The routes come
// from web/src/app (mounted read-only at /app-routes by the smoke service): a route group's
// "(name)" drops out of the URL and a "[param]" gets a stand-in, which still compiles the route
// even when its page then answers 404.
const ROUTES_DIR = "/app-routes";

function routes(dir = ROUTES_DIR, path = "") {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "page.tsx") found.push(path || "/");
    if (!entry.isDirectory()) continue;
    const segment = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name.replace(/^\[.*\]$/, "warm-up")}`;
    found.push(...routes(`${dir}/${entry.name}`, path + segment));
  }
  return found;
}

async function warmRoutes() {
  if (!fs.existsSync(ROUTES_DIR)) return;
  const queue = [...new Set(routes())];
  const started = Date.now();
  // A few at a time: the dev server compiles them in parallel, and one slow route can't hold the rest.
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        await fetch(`http://web:8080${path}`, { signal: AbortSignal.timeout(120_000) });
      } catch {
        // A route that fails here fails in its test too, where it says why.
      }
    }
  }));
  console.log(`warmed every route in ${Math.round((Date.now() - started) / 1000)}s`);
}
