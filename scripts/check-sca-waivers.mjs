import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const waiversPath = path.join(repoRoot, "security", "sca-waivers.json");

const raw = fs.readFileSync(waiversPath, "utf8");
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed.waivers)) {
  throw new Error("security/sca-waivers.json must contain a waivers array.");
}

const now = new Date();

for (const waiver of parsed.waivers) {
  for (const field of ["id", "package", "reason", "expiresOn"]) {
    if (!waiver[field]) {
      throw new Error(`Waiver is missing required field: ${field}`);
    }
  }

  const expiry = new Date(`${waiver.expiresOn}T00:00:00Z`);
  if (Number.isNaN(expiry.valueOf())) {
    throw new Error(`Waiver ${waiver.id} has invalid expiresOn.`);
  }

  if (expiry < now) {
    throw new Error(`Waiver ${waiver.id} expired on ${waiver.expiresOn}.`);
  }
}

console.log(`Validated ${parsed.waivers.length} SCA waiver entries.`);
