import fs from "node:fs";
import path from "node:path";

import {parse} from "yaml";

const root = process.env.QUANTOS_GATE_ROOT ?? path.resolve(new URL("..", import.meta.url).pathname);
const template = parse(fs.readFileSync(path.join(root, "buf.gen.yaml"), "utf8"));
const remotePlugins = (template.plugins ?? []).filter((plugin) => plugin.remote);

if (remotePlugins.length === 0) throw new Error("No remote Buf plugins configured");
for (const plugin of remotePlugins) {
  if (!/^buf\.build\/[^:]+:v[^:]+$/.test(plugin.remote)) {
    throw new Error(`Remote Buf plugin is not version-pinned: ${plugin.remote}`);
  }
}

const generateScript = fs.readFileSync(path.join(root, "scripts", "generate-proto.sh"), "utf8");
if (/\bdep\s+update\b/.test(generateScript)) {
  throw new Error("Routine proto generation must not update buf.lock");
}

const makefile = fs.readFileSync(path.join(root, "Makefile"), "utf8");
if (!/^proto-deps-update:/m.test(makefile) || !/\bbuf dep update\b/.test(makefile)) {
  throw new Error("Missing explicit proto-deps-update maintenance target");
}

console.log(`Validated ${remotePlugins.length} pinned Buf plugins and locked generation workflow.`);
