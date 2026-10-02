/** MSW resolvers backed by handlers generated from the frozen BFF OpenAPI. */
import { HttpResponse } from "msw";
import { createGeneratedBffHandlers } from "./generated/quantos-bff.msw";
import { loadValidatedFixture as load } from "./fixture-inventory.mjs";

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
    return HttpResponse.json(load("strategy/default.json"));
  },
});
