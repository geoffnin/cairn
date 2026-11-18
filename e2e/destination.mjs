// Stands in for the sites go links point to, so redirects can be followed to the end without
// leaving the machine. Answers every path with a page that names it. (Playwright's page.route
// cannot do this: it does not see the request a redirect leads to.)
import { createServer } from "node:http";

const PORT = Number(process.env.DEST_PORT ?? 8790);

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><title>Destination</title><p>Arrived at ${path.replace(/[<&]/g, "")}</p>`);
}).listen(PORT, "localhost");
