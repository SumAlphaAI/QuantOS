import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const outputFlagIndex = process.argv.indexOf("--output");
const outputPath =
  outputFlagIndex >= 0
    ? path.resolve(process.argv[outputFlagIndex + 1])
    : path.join(repoRoot, "artifacts", "sbom", "quantos.spdx.json");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function field(block, name) {
  return block.match(new RegExp(`^${name} = "([^"]*)"$`, "m"))?.[1];
}

function spdxId(ecosystem, name, version) {
  const safe = `${ecosystem}-${name}-${version}`.replace(/[^A-Za-z0-9.-]/g, "-");
  return `SPDXRef-${safe}-${sha256(`${ecosystem}:${name}:${version}`).slice(0, 10)}`;
}

function packageEntry(ecosystem, name, version, source, checksum) {
  const entry = {
    name,
    SPDXID: spdxId(ecosystem, name, version),
    versionInfo: version,
    downloadLocation: source || "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    supplier: "NOASSERTION",
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: `pkg:${ecosystem}/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      },
    ],
  };
  if (checksum) {
    entry.checksums = [{ algorithm: "SHA256", checksumValue: checksum }];
  }
  return entry;
}

function parseTomlPackages(content, ecosystem) {
  return content
    .split("[[package]]")
    .slice(1)
    .map((block) => {
      const name = field(block, "name");
      const version = field(block, "version");
      if (!name || !version) return null;
      return packageEntry(
        ecosystem,
        name,
        version,
        field(block, "source"),
        field(block, "checksum"),
      );
    })
    .filter(Boolean);
}

function parsePnpmPackages(content) {
  const packagesSection = content.match(/^packages:\n([\s\S]*?)(?=^snapshots:)/m)?.[1] ?? "";
  const entries = [];
  for (const match of packagesSection.matchAll(/^ {2}(?! )(?:'([^']+)'|([^:\n]+)):\s*$/gm)) {
    const key = match[1] ?? match[2];
    const separator = key.lastIndexOf("@");
    if (separator <= 0) continue;
    entries.push(packageEntry("npm", key.slice(0, separator), key.slice(separator + 1)));
  }
  return entries;
}

const cargoLock = read("Cargo.lock");
const pnpmLock = read("pnpm-lock.yaml");
const uvLock = read("engines/uv.lock");
const lockDigest = sha256(`${sha256(cargoLock)}:${sha256(pnpmLock)}:${sha256(uvLock)}`);
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const commitTime = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();

const dependencies = [
  ...parseTomlPackages(cargoLock, "cargo"),
  ...parsePnpmPackages(pnpmLock),
  ...parseTomlPackages(uvLock, "pypi"),
].sort((left, right) => left.SPDXID.localeCompare(right.SPDXID));
const rootPackage = {
  name: "sumalpha-quantos",
  SPDXID: "SPDXRef-Package-QuantOS",
  versionInfo: commit,
  downloadLocation: "NOASSERTION",
  filesAnalyzed: false,
  licenseConcluded: "NOASSERTION",
  licenseDeclared: "NOASSERTION",
  supplier: "Organization: SumAlpha",
  checksums: [{ algorithm: "SHA256", checksumValue: lockDigest }],
};
const document = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: "sumalpha-quantos",
  documentNamespace: `https://sumalpha.ai/spdx/sumalpha-quantos/${commit}/${lockDigest}`,
  creationInfo: {
    created: new Date(commitTime).toISOString().replace(".000Z", "Z"),
    creators: ["Tool: scripts/generate-sbom.mjs"],
  },
  packages: [rootPackage, ...dependencies],
  relationships: dependencies.map((dependency) => ({
    spdxElementId: rootPackage.SPDXID,
    relationshipType: "DEPENDS_ON",
    relatedSpdxElement: dependency.SPDXID,
  })),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Generated SPDX SBOM with ${dependencies.length} locked packages at ${path.relative(repoRoot, outputPath)}.`);
