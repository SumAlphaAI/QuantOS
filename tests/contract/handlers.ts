/**
 * MSW contract handlers：以 fixture 驱动 mock 响应（local-mock 环境）。
 * 页面级 OpenAPI 冻结（BFF-FE-000）后，handlers 将由同一 OpenAPI 生成，fixture 保持不变。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { http, HttpResponse } from "msw";

const dir = fileURLToPath(new URL(".", import.meta.url));
const load = (rel) => JSON.parse(readFileSync(join(dir, "fixtures", rel), "utf8"));

const BFF = "http://localhost:4010";

export const handlers = [
  http.get(`${BFF}/v1/command-center`, ({ request }) => {
    if (!request.headers.get("authorization")) {
      return HttpResponse.json(load("command-center/unauthorized.json"), { status: 403 });
    }
    return HttpResponse.json(load("command-center/default.json"));
  }),
  http.get(`${BFF}/v1/command-center/stale`, () => HttpResponse.json(load("command-center/stale.json"))),
  http.get(`${BFF}/v1/proposals/:proposalId`, () => HttpResponse.json(load("proposal/default.json"))),
];
