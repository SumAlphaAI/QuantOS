import { bffZodSchemas, createBffClient, parseBffResponse, type BffOperations } from "@sumalpha/api-client";

export const PRIVACY_NOTICE_VERSION = "2026-08-15";
export type AccessRequest = BffOperations["submitAccessRequest"]["requestBody"]["content"]["application/json"];
export interface AccessDraft { teamName: string; contactEmail: string; purpose: string; market: string; expectedMode: string; consent: boolean; website: string }
export class AccessSubmissionError extends Error {
  constructor(message: string, readonly outcomeUnknown = false, readonly status?: number) { super(message); this.name = "AccessSubmissionError"; }
}
export function accessPayload(draft: AccessDraft): AccessRequest | null {
  if (draft.website !== "") return null; // honeypot is never transmitted
  const teamName = draft.teamName.trim(), contactEmail = draft.contactEmail.trim(), purpose = draft.purpose.trim();
  if (!draft.consent || teamName.length < 2 || teamName.length > 100 || contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || purpose.length < 20 || purpose.length > 1000 || !["digital-assets", "equities", "futures"].includes(draft.market) || !["research", "paper", "shadow"].includes(draft.expectedMode)) throw new AccessSubmissionError("请检查团队、工作邮箱、用途、市场和隐私同意后重试。", false, 422);
  return { teamName, contactEmail, purpose, markets: [draft.market], expectedMode: draft.expectedMode as AccessRequest["expectedMode"], privacyNoticeVersion: PRIVACY_NOTICE_VERSION };
}
export function accessOrigin(configured: string | undefined, siteOrigin: string): string {
  const url = new URL(configured || siteOrigin);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new AccessSubmissionError("申请服务配置不可用，请联系支持。明文连接仅允许本机开发。", false);
  return url.origin;
}
export function createAccessSubmission(options: { origin?: string; siteOrigin: string; online: () => boolean; fetchImpl?: typeof fetch; timeoutMs?: number }) {
  const lifetime = new AbortController(); let active: AbortController | undefined, busy = false, accepted = false, uncertain = false;
  return {
    cancel() { active?.abort(); },
    close() { lifetime.abort(); active?.abort(); },
    acknowledgeRetry() { if (!busy && !accepted) uncertain = false; },
    async submit(draft: AccessDraft) {
      if (busy || accepted || uncertain || lifetime.signal.aborted) throw new AccessSubmissionError("当前申请不可重复提交；请先核查受理状态。", uncertain);
      const body = accessPayload(draft); if (!body) return null;
      if (!options.online()) throw new AccessSubmissionError("网络已断开，尚未发送申请；恢复连接后可手动提交。", false);
      const baseUrl = accessOrigin(options.origin, options.siteOrigin);
      busy = true; const controller = new AbortController(); active = controller;
      try {
        const client = createBffClient({ baseUrl, fetch: options.fetchImpl ?? fetch, signal: AbortSignal.any([controller.signal, lifetime.signal]), timeoutMs: options.timeoutMs ?? 15_000 });
        const result = await client.POST("/v1/access-requests", { body, credentials: "omit", cache: "no-store", redirect: "error" });
        if (controller.signal.aborted || lifetime.signal.aborted || !options.online()) throw new AccessSubmissionError("申请结果未知；请先核查受理状态。", true);
        if (result.response.status === 202) {
          let receipt;
          try { receipt = bffZodSchemas.AuditedAsyncAccepted.parse(parseBffResponse("submitAccessRequest", 202, result.data)); } catch { throw new AccessSubmissionError("受理响应无法核验，申请结果未知；请联系支持核查。", true); }
          if (receipt.status !== "accepted") throw new AccessSubmissionError("受理响应无法核验，申请结果未知；请联系支持核查。", true);
          accepted = true; return { correlationId: receipt.correlationId, jobId: receipt.jobId, auditRef: receipt.auditRef };
        }
        if (result.response.ok) throw new AccessSubmissionError("响应状态无法核验，申请结果未知；请联系支持核查。", true);
        const parsed = bffZodSchemas.ErrorEnvelope.safeParse(result.error), error = parsed.success ? parsed.data : undefined;
        const reference = error?.correlationId ? `（参考号 ${error.correlationId}）` : "";
        const retry = error?.retryAfter && error.retryAfter <= 86400 ? `建议等待 ${error.retryAfter} 秒。` : "";
        throw new AccessSubmissionError(result.response.status === 429 ? `申请提交过于频繁，请稍后重试。${retry}${reference}` : result.response.status === 422 ? `部分信息未通过校验，请检查后重试。${reference}` : `暂时无法确认申请，请联系支持或稍后手动重试。${reference}`, result.response.status >= 500, result.response.status);
      } catch (error) {
        const safe = error instanceof AccessSubmissionError ? error : new AccessSubmissionError("请求中断或响应无法核验，申请结果未知；请先联系支持核查，避免重复申请。", true);
        if (safe.outcomeUnknown) uncertain = true;
        throw safe;
      } finally { if (active === controller) active = undefined; busy = false; }
    },
  };
}
