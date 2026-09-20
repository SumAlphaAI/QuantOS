import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.env.QUANTOS_GATE_ROOT ?? path.resolve(new URL("..", import.meta.url).pathname);
const schemaDir = path.join(root, "proto", "jsonschema");
const plannedDomainSchemas = [
  "v1DataSnapshot",
  "v1ResearchArtifact",
  "v1StrategyRelease",
  "v1Signal",
  "v1TradeProposal",
  "v1RiskDecision",
  "v1TradeCommand",
  "v1Order",
  "v1Fill",
  "v1Position",
  "v1EventEnvelope",
];

const files = fs
  .readdirSync(schemaDir)
  .filter((entry) => entry.endsWith(".schema.json"))
  .sort();
const fileSet = new Set(files);

for (const name of plannedDomainSchemas) {
  const file = `${name}.schema.json`;
  if (!fileSet.has(file)) {
    throw new Error(`Missing planned domain JSON schema: ${file}`);
  }
}

const ajv = new Ajv2020({allErrors: true, strict: false});
addFormats(ajv);
for (const file of files) {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), "utf8"));
  ajv.compile(schema);
}

console.log(
  `Validated ${files.length} standalone JSON schemas and ${plannedDomainSchemas.length} planned domain schemas.`,
);
