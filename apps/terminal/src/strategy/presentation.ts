import type {StrategySummary} from "./policy";
export const strategyRef = (value: string) => value.length > 18 ? `${value.slice(0,8)}…${value.slice(-6)}` : value;
export function strategyCatalog(items: StrategySummary[], search: string) {
 const query = search.trim().toLocaleLowerCase();
 return items.filter(item => `${item.name}\n${item.strategyId}`.toLocaleLowerCase().includes(query));
}
export function filesFromJson(value: string): Record<string,string> | undefined {
 try {const files: unknown = JSON.parse(value);if (!files || typeof files !== "object" || Array.isArray(files) || Object.values(files).some(v => typeof v !== "string")) return;return files as Record<string,string>;} catch {return;}
}
export function replaceStrategyFile(value: string, name: string, content: string) {
 const files = filesFromJson(value);if (!files || !Object.hasOwn(files,name)) throw Error("Select an existing file");
 return JSON.stringify({...files,[name]:content},null,2);
}
export function parameterFields(value: string) {
 try {const parsed = JSON.parse(value);if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return [];
 const nested = parsed.parameters && typeof parsed.parameters === "object" && !Array.isArray(parsed.parameters), object = nested ? parsed.parameters : parsed;
 return Object.keys(object).sort().map(key => ({key,path:nested ? ["parameters",key] : [key],value:object[key] as unknown}));} catch {return [];}
}
/** Retain the provider's value type, including decimal strings; never coerce IDs or amounts. */
export function replaceParameter(value: string, path: string[], raw: string) {
 if (path.length < 1 || path.length > 2 || path.some(p => ["__proto__","constructor","prototype"].includes(p))) throw Error("Invalid parameter path");
 const parsed = JSON.parse(value);let object = parsed;for (const key of path.slice(0,-1)) {if (!object || !Object.hasOwn(object,key)) throw Error("Unknown parameter");object = object[key];}
 const key = path.at(-1)!;if (!object || !Object.hasOwn(object,key)) throw Error("Unknown parameter");
 const before = object[key], next = typeof before === "string" ? raw : JSON.parse(raw);
 if (before === null ? next !== null : Array.isArray(before) ? !Array.isArray(next) : typeof next !== typeof before || next === null || Array.isArray(next) || typeof next === "number" && !Number.isFinite(next)) throw Error("Parameter type changed");
 object[key] = next;return JSON.stringify(parsed,null,2);
}
export const draftStateLabels = {empty:"尚未读取草稿",saved:"已保存",dirty:"待自动保存",saving:"正在保存",conflict:"版本冲突：自动保存已暂停",uncertain:"保存结果未知：自动保存已暂停",error:"自动保存已暂停，请手动保存"} as const;
