import createClient, { type Client } from "openapi-fetch";

import type { paths } from "./bff-gen/quantos-bff.js";
import { createBffFetch, type BffRequestOptions } from "./bff-transport.js";

export type BffClient = Client<paths>;

export interface CreateBffClientOptions extends BffRequestOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/** Creates the production BFF client typed directly from the frozen OpenAPI. */
export function createBffClient({ baseUrl, fetch = globalThis.fetch, ...options }: CreateBffClientOptions): BffClient {
  return createClient<paths>({ baseUrl, credentials: "include", fetch: createBffFetch(fetch, options) });
}
