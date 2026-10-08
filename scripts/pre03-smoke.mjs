#!/usr/bin/env node

import { loadEffectiveConfig } from "./pre03-next-config.mjs";
export { loadEffectiveConfig } from "./pre03-next-config.mjs";
import { chromium } from "@playwright/test";
import { sourceDigest } from "./pre03-build-receipt.mjs";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };

export const expectedLockedVersions = {
  ".": { devDependencies: { "@next/eslint-plugin-next": "15.5.27" } },
  "apps/terminal": {
    dependencies: {
      "@tanstack/react-query": "5.101.4", "@tanstack/react-table": "8.21.3", "@tanstack/react-virtual": "3.14.9",
      echarts: "6.1.0", "lightweight-charts": "5.2.1", next: "15.5.27", "next-intl": "4.13.6",
      react: "19.2.8", "react-dom": "19.2.8", "react-hook-form": "7.85.0", zod: "4.4.3", zustand: "5.0.15",
    },
    devDependencies: { msw: "2.15.0", tailwindcss: "4.3.3", "@tailwindcss/postcss": "4.3.3" },
  },
  "apps/website": {
    dependencies: { next: "15.5.27", react: "19.2.8", "react-dom": "19.2.8" },
    devDependencies: { tailwindcss: "4.3.3", "@tailwindcss/postcss": "4.3.3" },
  },
  "packages/ui": {
    dependencies: { "@radix-ui/react-dialog": "1.1.23", "@radix-ui/react-tabs": "1.1.21" },
    devDependencies: { "@testing-library/react": "16.3.0", jsdom: "26.1.0", storybook: "8.6.18", vite: "6.4.3", react: "19.2.8", "react-dom": "19.2.8" },
  },
};

const normalizedVersion = (value) => /^\d+\.\d+\.\d+/.exec(String(value ?? ""))?.[0] ?? "";

function cargoPackageVersion(lock, name) {
  for (const block of lock.split("[[package]]").slice(1)) {
    if (new RegExp(`^\\s*name = "${name}"$`, "m").test(block)) return /^\s*version = "([^"]+)"$/m.exec(block)?.[1] ?? "";
  }
  return "";
}

export async function loadRuntimeInputs(root = repoRoot, { webOnly = true } = {}) {
  // Discover manifests from the phase-one workspace, never from the lock being checked.
  const workspace = parseYaml(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'));
  const apps = !webOnly && workspace.packages?.includes('apps/*')
    ? readdirSync(join(root, 'apps')).filter((name) => existsSync(join(root, 'apps', name, 'package.json'))).map((name) => `apps/${name}`)
    : ['apps/website', 'apps/terminal'];
  const roots = ['.', ...apps, ...readdirSync(join(root, 'packages'))
    .filter((name) => existsSync(join(root, 'packages', name, 'package.json'))).map((name) => `packages/${name}`)];
  const inputs = {
    workspace,
    rootPackage: JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
    nodeVersion: readFileSync(join(root, ".nvmrc"), "utf8").trim(),
    rustToolchain: readFileSync(join(root, "rust-toolchain.toml"), "utf8"),
    pnpmLock: parseYaml(readFileSync(join(root, "pnpm-lock.yaml"), "utf8")),
    terminalNextConfig: await loadEffectiveConfig(root, "terminal"),
    websiteNextConfig: await loadEffectiveConfig(root, "website"),
    manifests: Object.fromEntries(roots.map((name) => [name, JSON.parse(readFileSync(join(root,name,"package.json"),"utf8"))])),
    runtimeAdr: readFileSync(join(root, "docs/adr/20260814-pre03-runtime-stack.md"), "utf8"),
  };
  if (!webOnly) {
    inputs.tauriCargoLock = readFileSync(join(root, "apps/terminal-desktop/src-tauri/Cargo.lock"), "utf8");
    inputs.tauriConfig = JSON.parse(readFileSync(join(root, "apps/terminal-desktop/src-tauri/tauri.conf.json"), "utf8"));
    inputs.rustMain = readFileSync(join(root, "apps/terminal-desktop/src-tauri/src/main.rs"), "utf8");
  }
  return inputs;
}

export function validateRuntimeContract(inputs, { webOnly = true } = {}) {
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
  check(inputs.terminalNextConfig.output === "export", "Terminal uses static export");
  check(inputs.websiteNextConfig.output === "export", "Website uses static export");
  const workspaceScope = JSON.stringify(inputs.workspace.packages);
  check(workspaceScope === JSON.stringify(['apps/website', 'apps/terminal', 'packages/*'])
    || (!webOnly && workspaceScope === JSON.stringify(['apps/*', 'packages/*'])), 'workspace matches explicit Web/Desktop scope');
  check(JSON.stringify(Object.keys(inputs.manifests).sort()) === JSON.stringify(Object.keys(inputs.pnpmLock.importers ?? {}).sort()), 'all workspace importers match discovered manifests');
  const sortedEntries = (object) => JSON.stringify(Object.entries(object ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  check(sortedEntries(inputs.rootPackage.pnpm?.overrides) === sortedEntries(inputs.pnpmLock.overrides), 'pnpm overrides match root manifest');
  for (const [name, manifest] of Object.entries(inputs.manifests)) {
    const importer = inputs.pnpmLock.importers?.[name];
    for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
      const declared = manifest[section] ?? {};
      const locked = importer?.[section] ?? {};
      check(JSON.stringify(Object.keys(declared).sort()) === JSON.stringify(Object.keys(locked).sort()), `${name} ${section} dependency set matches lock`);
      for (const [dependency, specifier] of Object.entries(declared)) {
        const entry = locked[dependency];
        check(entry?.specifier === specifier, `${name} ${dependency} specifier matches manifest`);
        if (specifier.startsWith("workspace:")) {
          const targets = Object.entries(inputs.manifests).filter(([, target]) => target.name === dependency);
          const target = targets.length === 1 ? `link:${relative(name, targets[0][0]).split(sep).join('/')}` : null;
          check(target !== null && entry?.version === target, `${name} ${dependency} workspace link matches target package`);
        } else {
          const version = String(entry?.version ?? "");
          check(Boolean(inputs.pnpmLock.packages?.[`${dependency}@${version.split("(")[0]}`]?.resolution), `${name} ${dependency} package resolution exists`);
          check(Boolean(inputs.pnpmLock.snapshots?.[`${dependency}@${version}`]), `${name} ${dependency} snapshot exists`);
        }
      }
    }
  }
  for (const [key, snapshot] of Object.entries(inputs.pnpmLock.snapshots ?? {})) {
    check(Boolean(inputs.pnpmLock.packages?.[key.split("(")[0]]?.resolution), `snapshot ${key} has package resolution`);
    for (const [dependency, version] of Object.entries({ ...snapshot.dependencies, ...snapshot.optionalDependencies })) {
      const target = /^\d/.test(version) ? `${dependency}@${version}` : version;
      check(Boolean(inputs.pnpmLock.snapshots?.[target]), `snapshot ${key} dependency ${dependency} resolves`);
    }
  }
  check(inputs.manifests["packages/ui"].devDependencies?.["@testing-library/react"] === "16.3.0", "React Testing Library is a direct dependency");
  const adrRows = [...inputs.runtimeAdr.matchAll(/^\| ([^|]+) \| ([^|]+) \|$/gm)];
  for (const [name, sections] of Object.entries(expectedLockedVersions)) for (const dependencies of Object.values(sections)) for (const [dependency, version] of Object.entries(dependencies)) {
    const rows = adrRows.filter((row) => row[1] === dependency);
    check(rows.length === 1 && rows[0][2] === version, `${name} ${dependency} ADR version matches lock`);
  }
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

export async function checkPage(root, { name, directory, path, marker, selector, browser }) {
  const absoluteDirectory = join(root, directory);
  if (!existsSync(absoluteDirectory)) return { ok: false, message: `${name}: missing build output ${directory}` };
  const server = await serve(absoluteDirectory);
  let page;
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}${path}`);
    const body = await response.text();
    if (response.status !== 200 || !body.includes(marker)) throw new Error(`status=${response.status}, marker missing`);
    const assets = [...body.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css)(?:\?[^" ]*)?)"/g)].map((match) => match[1]);
    if (!assets.some((asset) => asset.includes(".js")) || !assets.some((asset) => asset.includes(".css"))) throw new Error("required JS/CSS references missing");
    for (const asset of new Set(assets)) {
      const url = new URL(asset,base);
      if (url.origin !== base) throw new Error("unexpected remote build resource");
      const resource = await fetch(url);
      if (resource.status !== 200 || !(await resource.text()).length) throw new Error(`missing resource ${asset}`);
    }
    page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (resource) => { if (/\.(js|css)(\?|$)/.test(resource.url()) && resource.status() >= 400) errors.push(`resource ${resource.status()} ${resource.url()}`); });
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.locator(selector).waitFor({ state:"visible", timeout:10000 });
    if (name === "terminal-web") await page.locator('[data-guard-state="allowed"]').waitFor({ state:"visible", timeout:10000 });
    if (errors.length) throw new Error(`browser errors: ${errors.join("; ")}`);
    return { ok:true, message:`${name}: ${path} resources and browser rendering verified` };
  } catch (error) {
    return { ok:false, message:`${name}: ${error.message}` };
  } finally {
    if (page) await page.close();
    await close(server);
  }
}

export function validateBuildReceipts(root, digest) {
  const checks = [], failures = [];
  for (const app of ["terminal", "website"]) {
    try {
      const receipt = JSON.parse(readFileSync(join(root, `apps/${app}/out/pre03-build.json`),"utf8"));
      if (receipt.schema !== "quantos-pre03-build/v1" || receipt.app !== app || receipt.sourceDigest !== (typeof digest === "string" ? digest : digest[app]) || receipt.output !== "export") throw new Error("stale or invalid build receipt");
      const id = readFileSync(join(root,`apps/${app}/.next/BUILD_ID`),"utf8").trim();
      if (id !== receipt.buildId) throw new Error("build ID mismatch");
      checks.push(`${app} build is bound to current source/config/profile`);
    } catch (error) { failures.push(`${app}: ${error.message}`); }
  }
  return { checks, failures };
}

export async function runPre03(root = repoRoot, { webOnly = true } = {}) {
  const inputs = await loadRuntimeInputs(root, { webOnly });
  const contract = validateRuntimeContract(inputs, { webOnly });
  const failures = [...contract.failures];
  const checks = [...contract.checks];
  const receipts = validateBuildReceipts(root, {
    terminal: sourceDigest(root, inputs.terminalNextConfig.publicEnv),
    website: sourceDigest(root, inputs.websiteNextConfig.publicEnv),
  });
  failures.push(...receipts.failures);
  checks.push(...receipts.checks);
  if (failures.length) return { ...contract, checks, failures, status:"FAIL", built_route_checks:0 };
  const browser = await chromium.launch({ headless:true });
  try {
    const pages = [];
    for (const options of [
      { name:"terminal-web", directory:"apps/terminal/out", path:"/command", marker:"static/chunks/app/command", selector:'[data-smoke="route-/command"]' },
      { name:"website", directory:"apps/website/out", path:"/", marker:'data-smoke="website-home"', selector:'[data-smoke="website-home"]' },
      ...(!webOnly ? [{name:"terminal-deep-link-gate",directory:"apps/terminal/out",path:"/auth/deep-link",marker:"static/chunks/app/auth/deep-link",selector:"main"}] : []),
    ]) pages.push(await checkPage(root,{...options,browser}));
    failures.push(...pages.filter((page) => !page.ok).map((page) => page.message));
    checks.push(...pages.filter((page) => page.ok).map((page) => page.message));
    return { ...contract, checks, failures, status:failures.length ? "FAIL":"PASS", built_route_checks:pages.length };
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const webOnly = !process.argv.includes("--desktop");
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
