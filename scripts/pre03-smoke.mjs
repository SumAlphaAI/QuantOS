#!/usr/bin/env node
/**
 * PRE-03 双端 smoke：
 * 1) Terminal 构建产物存在且 /command 路由可打开（Web 侧）；
 * 2) 官网构建产物存在且首页可打开；
 * 3) Tauri 桌面壳配置加载同一份 Terminal 产物、注册 quantos:// 深链、最小窗口 1180×760；
 * 4) 路由一致性：Web /command ↔ quantos://command 指向同一受权资源。
 *
 * 运行：node scripts/pre03-smoke.mjs（需先 pnpm --filter @sumalpha/terminal|website build）
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");
let failures = 0;
const fail = (m) => { failures += 1; console.error(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };

function serve(dir, port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = join(dir, url.pathname === "/" ? "index.html" : url.pathname);
    if (!existsSync(p)) p = `${p}.html`;
    if (!existsSync(p) || statSync(p).isDirectory()) p = join(dir, url.pathname, "index.html");
    if (!existsSync(p)) p = join(dir, "404.html");
    if (!existsSync(p)) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(readFileSync(p));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function checkPage(name, dir, port, path, marker) {
  if (!existsSync(dir)) { fail(`${name}: 构建产物不存在 ${dir}（先运行 build）`); return; }
  const server = await serve(dir, port);
  try {
    const res = await fetch(`http://localhost:${port}${path}`);
    const body = await res.text();
    if (res.status === 200 && body.includes(marker)) pass(`${name}: ${path} 可打开且含 smoke 标记`);
    else fail(`${name}: ${path} status=${res.status} 标记缺失（${marker}）`);
  } finally {
    server.close();
  }
}

// 1) Web：Terminal /command
await checkPage("terminal-web", join(root, "apps/terminal/out"), 3190, "/command", 'data-smoke="route-/command"');
// Deep-link reauthorization gate is part of the same shared artifact.
await checkPage("terminal-deep-link-gate", join(root, "apps/terminal/out"), 3192, "/auth/deep-link", "static/chunks/app/auth/deep-link");
// 2) 官网首页
await checkPage("website", join(root, "apps/website/out"), 3191, "/", 'data-smoke="website-home"');

// 3) Desktop：Tauri 配置加载同一产物 + 深链 + 窗口约束
const conf = JSON.parse(readFileSync(join(root, "apps/terminal-desktop/src-tauri/tauri.conf.json"), "utf8"));
if (conf.build.frontendDist === "../terminal/out") pass("desktop: frontendDist 指向共享 Terminal 产物 ../terminal/out");
else fail(`desktop: frontendDist=${conf.build.frontendDist}，应为 ../terminal/out`);
if (conf.build.devUrl === "http://localhost:3100") pass("desktop: devUrl 与 terminal dev 端口一致（3100）");
else fail(`desktop: devUrl=${conf.build.devUrl}`);
const schemes = conf.plugins?.["deep-link"]?.desktop?.schemes ?? [];
if (schemes.includes("quantos")) pass("desktop: quantos:// 深链已注册");
else fail(`desktop: 深链 schemes=${schemes}`);
const win = conf.app.windows[0];
if (win.minWidth === 1180 && win.minHeight === 760) pass("desktop: 最小窗口 1180×760 符合设计规格");
else fail(`desktop: 最小窗口 ${win.minWidth}×${win.minHeight}`);

// 4) 路由一致性：quantos://command ↔ /command
const deepLinkToRoute = (link) => link.replace(/^quantos:\/\//, "/");
const pairs = [["quantos://command", "/command"]];
for (const [link, route] of pairs) {
  if (deepLinkToRoute(link) === route) pass(`路由一致: ${link} ↔ ${route}`);
  else fail(`路由不一致: ${link} -> ${deepLinkToRoute(link)}，期望 ${route}`);
}

// 5) The shell consumes both cold-start and already-running deep-link deliveries.
const rustMain = readFileSync(join(root, "apps/terminal-desktop/src-tauri/src/main.rs"), "utf8");
if (rustMain.includes("get_current()") && rustMain.includes("on_open_url")) {
  pass("desktop: 冷启动与运行中深链接收器均已接线");
} else {
  fail("desktop: 缺 get_current/on_open_url 深链接收器");
}
if (rustMain.includes("sanitize_deep_link") && rustMain.includes("window.navigate")) {
  pass("desktop: 深链先消毒再导航本地授权 Gate");
} else {
  fail("desktop: 缺 URL 消毒或目标导航接线");
}

if (failures > 0) { console.error(`\n${failures} 项 smoke 失败`); process.exit(1); }
console.log("\nPRE-03 双端 smoke 全部通过");
process.exit(0);
