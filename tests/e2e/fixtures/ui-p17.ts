import { expect, type Page, type Request } from "@playwright/test";
import { bff, bundle, context as baseContext, id } from "./ui104";
export { bff, id };
export const now = new Date("2026-10-22T09:18:42Z");
export const context = () => ({ ...baseContext(), mode: "paper", capabilities: ["settings.read", "settings.write", "audit:read", "research.read", "execution.operate", "strategy.write", "ops.read"], expiresAt: new Date(now.getTime() + 300000).toISOString() });
export const writes = (requests: Request[]) => requests.filter(r => ["POST", "PUT", "DELETE"].includes(r.method()));
type Data = ReturnType<typeof bundle>;
type Override = { status?: number; data?: unknown; abort?: boolean; delay?: number };
export async function boundary(page: Page, hook: (request: Request, data: Data) => Override | undefined = () => undefined, theme: "dark" | "light" = "dark") {
  const data = bundle(), requests: Request[] = []; data.profile.theme = theme;
  const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-csrf-token,x-reauth-token-ref,idempotency-key,if-match,x-request-id", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
  await page.context().addCookies([{ name: "quantos_csrf", value: "csrf-fixture", url: "http://localhost:3190" }]);
  await page.route(`${bff}/**`, async route => {
    const request = route.request(); if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); requests.push(request);
    const custom = hook(request, data); if (custom?.abort) return route.abort("failed");
    if (custom?.delay) await new Promise(r => setTimeout(r, custom.delay));
    if (custom && "data" in custom) return route.fulfill({ status: custom.status ?? 200, headers: cors, contentType: "application/json", body: JSON.stringify(custom.data) });
    const path = new URL(request.url()).pathname; let body: unknown;
    if (path === "/v1/session" || path === "/v1/context") body = context();
    else if (path.endsWith("/challenges")) { expect(request.postDataJSON()).toEqual({ purpose: "security_change", code: "123456" }); body = { status: "verified", challengeRef: id }; }
    else if (path.endsWith("/reauth")) body = { reauthTokenRef: id, expiresAt: new Date(now.getTime() + 30000).toISOString() };
    else if (request.method() === "DELETE") return route.fulfill({ status: 202, headers: cors, contentType: "application/json", body: JSON.stringify({ status: "accepted", jobId: id, correlationId: id, auditRef: id }) });
    else if (path === "/v1/settings/profile") { if (request.method() === "PUT") { const input = request.postDataJSON(); for (const field of ["email", "roleLabels", "memberId", "objectVersion"]) expect(input).not.toHaveProperty(field); Object.assign(data.profile, input, { objectVersion: "profile-p15" }); } body = data.profile; }
    else if (path === "/v1/settings/notification-preferences") { if (request.method() === "PUT") Object.assign(data.notifications, request.postDataJSON(), { objectVersion: "notification-p15" }); body = data.notifications; }
    else if (path === "/v1/settings/security") body = data.security;
    else if (path === "/v1/settings/sessions") body = data.sessions;
    else if (path === "/v1/settings/trusted-devices") body = data.devices;
    else if (path === "/v1/settings/downloads") body = {items: data.downloads};
    else if (path === "/v1/platform/browser-capabilities") body = data.browserPolicy;
    else throw Error("Unplanned P17 request " + path);
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { data, requests };
}
