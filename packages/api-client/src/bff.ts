import createClient, { type Client } from "openapi-fetch";

import type { paths } from "./bff-gen/quantos-bff.js";

export type BffClient = Client<paths>;

export interface CreateBffClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/** Creates the production BFF client typed directly from the frozen OpenAPI. */
export function createBffClient({ baseUrl, fetch }: CreateBffClientOptions): BffClient {
  return createClient<paths>({ baseUrl, credentials: "include", fetch });
}
