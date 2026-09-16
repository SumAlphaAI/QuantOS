import type { BffComponents, BffOperations } from "@sumalpha/api-client";

type ErrorEnvelope = BffComponents["schemas"]["ErrorEnvelope"];
type MfaRequest = BffOperations["mfaChallenge"]["requestBody"]["content"]["application/json"];
type MfaResponse = BffOperations["mfaChallenge"]["responses"][200]["content"]["application/json"];
type ReauthRequest = BffOperations["reauth"]["requestBody"]["content"]["application/json"];
type ReauthResponse = BffOperations["reauth"]["responses"][200]["content"]["application/json"];
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
  csrfToken: string | undefined,
  fetchImpl: typeof fetch,
): Promise<TResponse> {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  if (csrfToken) headers["x-csrf-token"] = csrfToken;
  const response = await fetchImpl(`${origin}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  if (response.status !== acceptedStatus) throw await parseError(response);
  return await response.json() as TResponse;
}

export function completeLoginMfa(
  origin: string,
  code: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MfaResponse> {
  const body: MfaRequest = { purpose: "login", code };
  return postJson<MfaResponse>(origin, "/v1/auth/mfa/challenges", body, 200, csrfToken, fetchImpl);
}

export function completeRecentAuth(
  origin: string,
  challengeRef: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReauthResponse> {
  const body: ReauthRequest = { challengeRef };
  return postJson<ReauthResponse>(origin, "/v1/auth/reauth", body, 200, csrfToken, fetchImpl);
}

export function submitAccessRequest(
  origin: string,
  input: AccessRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessAccepted> {
  return postJson<AccessAccepted>(origin, "/v1/access-requests", input, 202, undefined, fetchImpl);
}
