/** MSW resolvers backed by handlers generated from the frozen BFF OpenAPI. */
import { HttpResponse } from "msw";
import { createGeneratedBffHandlers } from "./generated/quantos-bff.msw";
import { loadValidatedFixture as load } from "./fixture-inventory.mjs";
import { checkedResolvers } from "./http-contract.mjs";

const headers = { "X-Correlation-Id": "11111111-1111-4111-8111-111111111111", "Cache-Control": "no-store" };

export const handlers = createGeneratedBffHandlers(checkedResolvers({
  getSession: ({ request }) => {
    if (!request.headers.get("cookie")) {
      return HttpResponse.json(load("command-center/unauthorized.json"), { status: 401, headers });
    }
    return HttpResponse.json(load("session/default.json"), { headers });
  },
  getProposal: () => HttpResponse.json(load("proposal/default.json"), { headers }),
  mfaChallenge: () => {
    const body=load("errors/rate-limited.json");return HttpResponse.json(body, {status:429,headers:{...headers,"X-Correlation-Id":body.correlationId}});
  },
  saveStrategyDraft: ({ request }) => {
    if (request.headers.get("if-match") !== "draft-v3") {
      const body=load("errors/conflict.json");return HttpResponse.json(body, {status:409,headers:{...headers,"X-Correlation-Id":body.correlationId}});
    }
    return HttpResponse.json(load("strategy/default.json"), { headers: { ...headers, ETag: "draft-v3" } });
  },
}));
