/** Test-only adapter: generated operation metadata and runtime schemas are authoritative.
 * Scenario read models are projections, never production API DTOs or execution authority.
 */
import { createHash } from "node:crypto";
import { createBffFetch, parseBffResponse, bffZodSchemas, type BffOperationId, type BffComponents } from "@sumalpha/api-client";
import catalog from "../../../../../tests/contract/generated/quantos-bff.operations.json" with { type: "json" };
import { projectScenario, type WireValue } from "./wire.js";
export type Schemas = BffComponents["schemas"];
export const now = "2026-08-01T00:00:00Z";
export const hash = (value: string) => "sha256:" + createHash("sha256").update(value).digest("hex");
export const uuid = (value: string) => { const h=hash(value).slice(7); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; };
export interface ScenarioExchange { operation: BffOperationId; status: number; validated: true }
const traces = new WeakMap<object, ScenarioExchange[]>();
export const scenarioExchanges = (adapter: object): readonly ScenarioExchange[] => traces.get(adapter) ?? [];
/** No network: exercise the real production transport and generated response validator. */
export async function exchange({operation,status,payload}: WireValue): Promise<unknown> {
  const route=catalog.operations.find(o=>o.operationId===operation);
  if(!route) throw Error("scenario adapter requires a published operation");
  if(route.sse) return (payload as unknown[]).map(value=>bffZodSchemas.StreamEvent.parse(value));
  const fetcher=createBffFetch(async () => Response.json(payload,{status,headers:{"X-Correlation-Id":uuid("scenario"),"Cache-Control":"no-store"}}));
  const response=await fetcher(new Request("http://scenario.invalid"+route.path.replace(/\{[^}]+\}/g,uuid("resource")),{method:route.method}));
  return parseBffResponse(operation,response.status,await response.json());
}
export function generatedScenario<T extends object>(domain: string, state: T): T {
  const trace: ScenarioExchange[]=[];
  const adapter=new Proxy(state,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=="function")return value;
    return (...args: unknown[])=>{const result=Reflect.apply(value,target,args);
      if(!(result instanceof Promise))return result; // Explicit synchronous fixture controls, not HTTP APIs.
      return result.then(async view=>{const values=projectScenario(domain,String(key),args,view);if(!values.length)throw Error("scenario method has no generated contract");
        for(const item of values){await exchange(item);trace.push({operation:item.operation,status:item.status,validated:true});}
        return structuredClone(view); // UI-only projection retains historical presentation assertions.
      });};}});
  traces.set(adapter,trace);return adapter;
}
