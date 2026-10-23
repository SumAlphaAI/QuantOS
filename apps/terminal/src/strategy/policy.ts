import {bffZodSchemas, type BffComponents} from "@sumalpha/api-client";
export type StrategyDraft = BffComponents["schemas"]["StrategyDraft"];
export type DraftContent = Pick<StrategyDraft, "files" | "parameters">;
export type StrategySummary = BffComponents["schemas"]["StrategySummary"];
export const autosaveMs = 1000;
/** Same UTF-8 body limit as the C05 provider. JSON editors never evaluate code. */
export function parseDraftContent(files: string, parameters: string): DraftContent {
 const content = {files: JSON.parse(files), parameters: JSON.parse(parameters)};
 if (!content.files || Array.isArray(content.files) || typeof content.files !== "object" || Object.values(content.files).some(v => typeof v !== "string") || !content.parameters || Array.isArray(content.parameters) || typeof content.parameters !== "object") throw Error("Files and parameters must be JSON objects; file values must be strings");
 if (new TextEncoder().encode(JSON.stringify(content)).length > 32768) throw Error("Draft body exceeds 32768 bytes");
 return content;
}
export function strategyLocation(path: string, search = ""): {kind: "catalog" | "new" | "lab"; id?: string} {
 const parts = path.replace(/\/$/, "").split("/"), query = new URLSearchParams(search);
 if (query.has("strategyId")) throw Error("Ambiguous strategy route");
 if (parts.length === 2 && parts[1] === "strategies") return {kind: "catalog"};
 if (parts.length === 3 && parts[1] === "strategies" && parts[2] === "new") return {kind: "new"};
 if (parts.length === 4 && parts[1] === "strategies" && parts[3] === "lab") return {kind: "lab", id: bffZodSchemas.UUID.parse(parts[2]).toLowerCase()};
 throw Error("Invalid strategy route");
}
export const strategyLabPath = (id: string) => `/strategies/${bffZodSchemas.UUID.parse(id).toLowerCase()}/lab`;
/** Show complete per-field before/local/server values, including additions/deletions. */
export function draftDiff(base: DraftContent, local: DraftContent, server: DraftContent) {
 return (["files", "parameters"] as const).flatMap(section => [...new Set([...Object.keys(base[section]), ...Object.keys(local[section]), ...Object.keys(server[section])])].sort().filter(key => JSON.stringify(base[section][key]) !== JSON.stringify(local[section][key]) || JSON.stringify(base[section][key]) !== JSON.stringify(server[section][key])).map(key => ({section, key, base: base[section][key], local: local[section][key], server: server[section][key]})));
}
