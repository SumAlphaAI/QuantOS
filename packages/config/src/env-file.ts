import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Server/CLI-only entry. Next's bundled dotenv + expansion mutates process.env
// and caches its initial environment; isolate each file from the caller and peers.
const worker = `
import { readFileSync } from 'node:fs';
const { default: nextEnv } = await import(process.argv[1]);
const { processEnv } = nextEnv;
const [, parsed] = processEnv([{path: '.env', contents: readFileSync(0, 'utf8'), env: {}}], '',
  {error() {throw new Error('dotenv parsing failed');}}, true);
process.stdout.write(JSON.stringify(parsed));
`;
export function parseEnvText(text: string): Record<string, string> {
  const require = createRequire(import.meta.url);
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", worker,
    pathToFileURL(require.resolve("@next/env")).href], {
    input: text, encoding: "utf8", env: {}, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

/** Read the production build's effective environment without polluting other apps. */
export function loadProductionEnv(directory: string, inherited: Record<string, string | undefined>): Record<string, string> {
  const require = createRequire(import.meta.url);
  const script = `
const { default: nextEnv } = await import(process.argv[1]);
const { combinedEnv } = nextEnv.loadEnvConfig(process.argv[2], false,
  {info() {}, error() {throw new Error('environment loading failed');}}, true);
process.stdout.write(JSON.stringify(combinedEnv));
`;
  const environment = { ...inherited, NODE_ENV: "production" };
  // This marker is internal to @next/env; a new worker must load its own files.
  delete (environment as Record<string, string | undefined>).__NEXT_PROCESSED_ENV;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script,
    pathToFileURL(require.resolve("@next/env")).href, directory], {
    encoding: "utf8", env: environment, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
  }));
}
