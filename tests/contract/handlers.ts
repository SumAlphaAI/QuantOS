/** MSW resolvers backed by handlers generated from the frozen BFF OpenAPI. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HttpResponse } from "msw";

import { createGeneratedBffHandlers } from "./generated/quantos-bff.msw";

const dir = fileURLToPath(new URL(".", import.meta.url));
const load = (rel) => JSON.parse(readFileSync(join(dir, "fixtures", rel), "utf8"));

export const handlers = createGeneratedBffHandlers({
  getSession: ({ request }) => {
    if (!request.headers.get("authorization")) {
      return HttpResponse.json(load("command-center/unauthorized.json"), { status: 403 });
    }
    return HttpResponse.json(load("session/default.json"));
  },
  getProposal: () => HttpResponse.json(load("proposal/default.json")),
});
