#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };

const expectedLockedVersions = {
  "apps/terminal": {
    dependencies: {
      "@tanstack/react-query": "5.101.4", "@tanstack/react-table": "8.21.3", "@tanstack/react-virtual": "3.14.9",
      echarts: "6.1.0", "lightweight-charts": "5.2.1", next: "15.5.23", "next-intl": "4.13.6",
      react: "19.2.8", "react-dom": "19.2.8", "react-hook-form": "7.85.0", zod: "4.4.3", zustand: "5.0.15",
    },
    devDependencies: { msw: "2.15.0", tailwindcss: "4.3.3", "@tailwindcss/postcss": "4.3.3" },
  },
  "apps/website": {
    dependencies: { next: "15.5.23", react: "19.2.8", "react-dom": "19.2.8" },
    devDependencies: { tailwindcss: "4.3.3", "@tailwindcss/postcss": "4.3.3" },
  },
  "packages/ui": {
    dependencies: { "@radix-ui/react-dialog": "1.1.23", "@radix-ui/react-tabs": "1.1.21" },
    devDependencies: { storybook: "8.6.18", vite: "6.4.3", react: "19.2.8", "react-dom": "19.2.8" },
  },
};

const normalizedVersion = (value) => /^\d+\.\d+\.\d+/.exec(String(value ?? ""))?.[0] ?? "";

function cargoPackageVersion(lock, name) {
  for (const block of lock.split("[[package]]").slice(1)) {
    if (new RegExp(`^\\s*name = "${name}"$`, "m").test(block)) return /^\s*version = "([^"]+)"$/m.exec(block)?.[1] ?? "";
  }
  return "";
}

export function loadRuntimeInputs(root = repoRoot, { webOnly = false } = {}) {
  const inputs = {
    rootPackage: JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
    nodeVersion: readFileSync(join(root, ".nvmrc"), "utf8").trim(),
    rustToolchain: readFileSync(join(root, "rust-toolchain.toml"), "utf8"),
    pnpmLock: parseYaml(readFileSync(join(root, "pnpm-lock.yaml"), "utf8")),
    terminalNextConfig: readFileSync(join(root, "apps/terminal/next.config.ts"), "utf8"),
    websiteNextConfig: readFileSync(join(root, "apps/website/next.config.ts"), "utf8"),
  };
  if (!webOnly) {
    inputs.tauriCargoLock = readFileSync(join(root, "apps/terminal-desktop/src-tauri/Cargo.lock"), "utf8");
    inputs.tauriConfig = JSON.parse(readFileSync(join(root, "apps/terminal-desktop/src-tauri/tauri.conf.json"), "utf8"));
    inputs.rustMain = readFileSync(join(root, "apps/terminal-desktop/src-tauri/src/main.rs"), "utf8");
  }
  return inputs;
}

export function validateRuntimeContract(inputs, { webOnly = false } = {}) {
  const failures = [];
  const checks = [];
  const check = (condition, message) => (condition ? checks : failures).push(message);

  check(inputs.rootPackage.packageManager === "pnpm@10.20.0", "pnpm is pinned to 10.20.0");
  check(inputs.nodeVersion === "24.12.0", "Node is pinned to 24.12.0");
  check(/channel = "1\.91\.0"/.test(inputs.rustToolchain), "Rust is pinned to 1.91.0");
  check(inputs.pnpmLock.lockfileVersion === "9.0", "pnpm lockfile format is 9.0");

  for (const [importerName, sections] of Object.entries(expectedLockedVersions)) {
    const importer = inputs.pnpmLock.importers?.[importerName];
    check(Boolean(importer), `${importerName} exists in pnpm lock importers`);
    for (const [section, dependencies] of Object.entries(sections)) {
      for (const [name, expected] of Object.entries(dependencies)) {
        const actual = normalizedVersion(importer?.[section]?.[name]?.version);
        check(actual === expected, `${importerName} ${name} locked at ${expected}`);
      }
    }
  }
  check(inputs.terminalNextConfig.includes('output: "export"'), "Terminal uses static export");
  check(inputs.websiteNextConfig.includes('output: "export"'), "Website uses static export");
  if (!webOnly) {
    check(cargoPackageVersion(inputs.tauriCargoLock, "tauri") === "2.11.5", "Tauri is locked at 2.11.5");
    check(cargoPackageVersion(inputs.tauriCargoLock, "tauri-plugin-deep-link") === "2.4.9", "Tauri deep-link plugin is locked at 2.4.9");
    check(inputs.tauriConfig.build?.frontendDist === "../terminal/out", "Desktop loads the shared Terminal out directory");
    check(inputs.tauriConfig.build?.devUrl === "http://localhost:3100", "Desktop dev URL matches Terminal port 3100");
    check(inputs.tauriConfig.plugins?.["deep-link"]?.desktop?.schemes?.includes("quantos"), "quantos deep-link scheme is registered");
    const window = inputs.tauriConfig.app?.windows?.[0];
    check(window?.minWidth === 1180 && window?.minHeight === 760, "desktop minimum window is 1180x760");
    check(inputs.rustMain.includes("get_current()") && inputs.rustMain.includes("on_open_url"), "cold and warm deep-link receivers are wired");
    check(inputs.rustMain.includes("sanitize_deep_link") && inputs.rustMain.includes("window.navigate"), "deep links are sanitized before local navigation");
  }

  return { schema: "quantos-pre03/v1", scope: webOnly ? "web-only" : "web-and-desktop", status: failures.length === 0 ? "PASS" : "FAIL", checks, failures, locked_dependencies: Object.values(expectedLockedVersions).reduce((total, sections) => total + Object.values(sections).reduce((count, dependencies) => count + Object.keys(dependencies).length, 0), 0), runtime_contract_checks: checks.length + failures.length };
}

function serve(directory) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let path = join(directory, url.pathname === "/" ? "index.html" : url.pathname);
    if (!existsSync(path)) path = `${path}.html`;
    if (!existsSync(path) || statSync(path).isDirectory()) path = join(directory, url.pathname, "index.html");
    if (!existsSync(path)) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    response.end(readFileSync(path));
  });
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

async function close(server) {
  await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
}

async function checkPage(root, { name, directory, path, marker }) {
  const absoluteDirectory = join(root, directory);
  if (!existsSync(absoluteDirectory)) return { ok: false, message: `${name}: missing build output ${directory}` };
  const server = await serve(absoluteDirectory);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    const body = await response.text();
    return response.status === 200 && body.includes(marker)
      ? { ok: true, message: `${name}: ${path} is served from built output` }
      : { ok: false, message: `${name}: ${path} status=${response.status}, marker missing (${marker})` };
  } finally {
    await close(server);
  }
}

export async function runPre03(root = repoRoot, { webOnly = false } = {}) {
  const contract = validateRuntimeContract(loadRuntimeInputs(root, { webOnly }), { webOnly });
  const pageChecks = [
    checkPage(root, { name: "terminal-web", directory: "apps/terminal/out", path: "/command", marker: "static/chunks/app/command" }),
    checkPage(root, { name: "website", directory: "apps/website/out", path: "/", marker: 'data-smoke="website-home"' }),
  ];
  if (!webOnly) {
    pageChecks.push(checkPage(root, { name: "terminal-deep-link-gate", directory: "apps/terminal/out", path: "/auth/deep-link", marker: "static/chunks/app/auth/deep-link" }));
  }
  const pages = await Promise.all(pageChecks);
  const failures = [...contract.failures, ...pages.filter((page) => !page.ok).map((page) => page.message)];
  return { ...contract, status: failures.length === 0 ? "PASS" : "FAIL", failures, built_route_checks: pages.length, checks: [...contract.checks, ...pages.filter((page) => page.ok).map((page) => page.message)] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const webOnly = process.argv.includes("--web-only");
    const report = await runPre03(repoRoot, { webOnly });
    if (report.status === "FAIL") {
      for (const failure of report.failures) console.error(`FAIL  ${failure}`);
      process.exitCode = 1;
    } else {
      const { checks: _checks, failures: _failures, ...summary } = report;
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  } catch (error) {
    console.error(`PRE-03 smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
