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
  mfaChallenge: () => HttpResponse.json(load("errors/rate-limited.json"), { status: 429 }),
  saveStrategyDraft: ({ request }) => {
    if (request.headers.get("if-match") !== "draft-v3") {
      return HttpResponse.json(load("errors/conflict.json"), { status: 409 });
    }
    return HttpResponse.json({
      strategyId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      name: "Momentum baseline",
      thesis: "Deterministic fixture after version refresh.",
      universe: ["BTC-USD"],
      parameters: { lookback: 20 },
      status: "draft",
      objectVersion: "draft-v4",
      updatedAt: "2026-09-16T08:00:00Z",
    });
  },
});
