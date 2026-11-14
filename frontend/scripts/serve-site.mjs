// Lightweight local static server for QAVRIL LABS marketing frontend.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "site");
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname);
  let relPath = urlPath === "/" ? "index.html" : urlPath.slice(1);
  let filePath = path.join(siteDir, relPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const notFoundPath = path.join(siteDir, "404.html");
    const content = fs.existsSync(notFoundPath) ? fs.readFileSync(notFoundPath) : "404 Not Found";
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(content);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": content.length,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(content);
});

server.listen(port, host, () => {
  console.log(`QAVRIL LABS Frontend running at http://${host}:${port}/`);
});

