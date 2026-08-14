#!/usr/bin/env node
/** 极简静态文件服务（Playwright webServer / smoke 用）：node scripts/serve-static.mjs <dir> <port> */
import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname } from "node:path";

const [dir, portArg] = process.argv.slice(2);
if (!dir || !portArg) {
  console.error("用法：serve-static.mjs <dir> <port>");
  process.exit(2);
}
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let p = join(dir, url.pathname === "/" ? "index.html" : url.pathname);
  if (!existsSync(p)) p = `${p}.html`;
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(dir, url.pathname, "index.html");
  if (!existsSync(p)) p = join(dir, "404.html");
  if (!existsSync(p)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(Number(portArg), () => console.log(`serving ${dir} on :${portArg}`));
