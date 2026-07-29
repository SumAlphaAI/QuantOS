import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const allowlistPath = path.join(repoRoot, "security", "node-license-allowlist.json");
const noticesPath = path.join(repoRoot, "THIRD_PARTY_NOTICES.md");

const { allowedLicenses } = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));

const raw = execFileSync(
  "pnpm",
  [
    "exec",
    "license-checker-rseidelsohn",
    "--summary",
    "--onlyAllow",
    allowedLicenses.join(";"),
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (!fs.existsSync(noticesPath)) {
  throw new Error("THIRD_PARTY_NOTICES.md is required.");
}

process.stdout.write(raw);
