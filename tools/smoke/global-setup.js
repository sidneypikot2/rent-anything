// The browser must see the app exactly where a person does — http://localhost:<web
// port>, talking to http://localhost:<backend port> — because web/src/lib/config.ts
// derives the API URL from that address and the backend's CORS check only allows it. Inside this container "localhost" is the container itself, so
// forward those two ports to the Compose services. Plain TCP, so the WebSocket works too.
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
  const { FRONTEND_PORT, BACKEND_PORT } = process.env;
  if (!FRONTEND_PORT || !BACKEND_PORT) throw new Error("FRONTEND_PORT and BACKEND_PORT must be set (run through script/smoke)");

  const servers = [
    await forward(Number(FRONTEND_PORT), "web", 8080),
    await forward(Number(BACKEND_PORT), "backend", 3000),
  ];
  return () => servers.forEach((server) => server.close());
}
