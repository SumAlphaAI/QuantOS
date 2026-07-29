import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const openApiDir = path.join(repoRoot, "proto", "openapi");
const schemaDir = path.join(repoRoot, "proto", "jsonschema");

if (!fs.existsSync(openApiDir)) {
  throw new Error("proto/openapi does not exist. Run buf generate first.");
}

const candidates = fs
  .readdirSync(openApiDir)
  .filter((entry) => entry.endsWith(".json"))
  .map((entry) => path.join(openApiDir, entry))
  .sort();

if (candidates.length === 0) {
  throw new Error("No OpenAPI JSON artifacts found in proto/openapi.");
}

const document = JSON.parse(fs.readFileSync(candidates[0], "utf8"));
const definitions = document.definitions ?? document.components?.schemas ?? {};

fs.mkdirSync(schemaDir, { recursive: true });

for (const [name, schema] of Object.entries(definitions)) {
  const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const outputPath = path.join(schemaDir, `${cleanName}.schema.json`);
  const payload = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://sumalpha.ai/schemas/${cleanName}.schema.json`,
    title: cleanName,
    ...schema,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
}

console.log(`Extracted ${Object.keys(definitions).length} JSON schema documents.`);
