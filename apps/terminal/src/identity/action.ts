import { BffTransportError } from "@sumalpha/api-client";
import { AuthBffError, submitAccessRequest } from "../auth/bff";

export const privacyNoticeVersion = "2026-08-15";
export class IdentityActionError extends Error {
  constructor(message: string, readonly outcomeUnknown = false) { super(message); }
}

/** One write at a time. Network recovery never replays a previous intent. */
export function createIdentityAction(options: { online: () => boolean; now?: () => number }) {
  const now = options.now ?? Date.now;
  let active: AbortController | undefined, closed = false, uncertain = false, deadline = 0;
  return {
    cancel() { active?.abort(); },
    close() { closed = true; active?.abort(); },
    remaining() { return Math.max(0, Math.ceil((deadline - now()) / 1000)); },
    acknowledgeRetry() { if (!active && !closed) uncertain = false; },
    async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
      if (closed || active || uncertain || now() < deadline) throw new IdentityActionError("当前请求不可重复提交，请先核查状态或等待重试。", uncertain);
      if (!options.online()) throw new IdentityActionError("网络已断开，尚未发送请求。恢复连接后请手动重试。");
      const controller = new AbortController(); active = controller;
      try {
        const result = await operation(controller.signal);
        if (closed || controller.signal.aborted || !options.online()) throw new IdentityActionError("请求结果未知，请先核查状态。", true);
        return result;
      } catch (error) {
        if (error instanceof AuthBffError) {
          if (error.status === 429) deadline = now() + Math.max(1, error.retryAfter ?? 60) * 1000;
          if (error.status >= 500) uncertain = true;
        } else if (!(error instanceof BffTransportError) || error.outcomeUnknown) uncertain = true;
        if (error instanceof IdentityActionError && !error.outcomeUnknown) uncertain = false;
        const message = uncertain ? "请求结果未知，请先核查状态，避免重复提交。" : error instanceof AuthBffError && error.status === 429 ? `请求过于频繁，请在 ${this.remaining()} 秒后重试。` : "暂时无法完成请求。请检查输入或重新登录后重试。";
        throw new IdentityActionError(message, uncertain);
      } finally { if (active === controller) active = undefined; }
    },
  };
}

export function accessPayload(data: FormData) {
  if (String(data.get("website") ?? "")) throw new IdentityActionError("请检查输入后重试。");
  const teamName = String(data.get("teamName") ?? "").trim(), contactEmail = String(data.get("contactEmail") ?? "").trim(), purpose = String(data.get("purpose") ?? "").trim();
  const market = String(data.get("market") ?? ""), expectedMode = String(data.get("expectedMode") ?? "");
  if (teamName.length < 2 || teamName.length > 100 || contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || purpose.length < 20 || purpose.length > 1000 || !["digital-assets", "equities", "futures"].includes(market) || !["research", "paper", "shadow"].includes(expectedMode) || data.get("consent") !== "on") throw new IdentityActionError("请检查团队、工作邮箱、用途、市场、模式和隐私同意后重试。");
  return { teamName, contactEmail, purpose, markets: [market], expectedMode: expectedMode as "research" | "paper" | "shadow", privacyNoticeVersion };
}

export async function requestAccess(origin: string, body: ReturnType<typeof accessPayload>, signal: AbortSignal, fetchImpl = fetch) {
  const result = await submitAccessRequest(origin, body, fetchImpl, { signal, timeoutMs: 15_000 });
  if (result.status !== "accepted") throw new IdentityActionError("受理响应无法核验，请先核查状态。", true);
  return result;
}
