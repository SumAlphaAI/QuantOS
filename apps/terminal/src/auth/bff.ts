import type { BffComponents, BffOperations } from "@sumalpha/api-client";

type ErrorEnvelope = BffComponents["schemas"]["ErrorEnvelope"];
type MfaRequest = BffOperations["mfaChallenge"]["requestBody"]["content"]["application/json"];
type MfaResponse = BffOperations["mfaChallenge"]["responses"][200]["content"]["application/json"];
type AccessRequest = BffOperations["submitAccessRequest"]["requestBody"]["content"]["application/json"];
type AccessAccepted = BffOperations["submitAccessRequest"]["responses"][202]["content"]["application/json"];

export class AuthBffError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId?: string,
    readonly retryAfter?: number,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AuthBffError";
  }
}

async function parseError(response: Response): Promise<AuthBffError> {
  let body: Partial<ErrorEnvelope> = {};
  try {
    body = await response.json() as Partial<ErrorEnvelope>;
  } catch {
    // Safe generic error below; never expose transport details.
  }
  return new AuthBffError(
    response.status === 429
      ? "验证请求过于频繁，请稍后重试。"
      : "暂时无法完成请求。请重试；如果问题持续，请联系支持。",
    response.status,
    body.correlationId,
    body.retryAfter,
    body.fieldErrors,
  );
}

async function postJson<TResponse>(
  origin: string,
  path: string,
  body: unknown,
  acceptedStatus: number,
  fetchImpl: typeof fetch,
): Promise<TResponse> {
  const response = await fetchImpl(`${origin}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status !== acceptedStatus) throw await parseError(response);
  return await response.json() as TResponse;
}

export function completeLoginMfa(
  origin: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MfaResponse> {
  const body: MfaRequest = { purpose: "login", code };
  return postJson<MfaResponse>(origin, "/v1/auth/mfa/challenges", body, 200, fetchImpl);
}

export function submitAccessRequest(
  origin: string,
  input: AccessRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessAccepted> {
  return postJson<AccessAccepted>(origin, "/v1/access-requests", input, 202, fetchImpl);
}
