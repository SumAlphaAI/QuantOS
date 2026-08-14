import { sanitizeReturnPath } from "./flow";

export type DeepLinkAuthorizationDecision =
  | { kind: "allow"; route: string }
  | { kind: "login"; route: string }
  | { kind: "unavailable" };

/**
 * Converts the authoritative BFF session response into a fail-closed route.
 * A deep link never bypasses this check, even when the local UI has session state.
 */
export function authorizeDeepLinkTarget(
  rawTarget: string | null | undefined,
  sessionStatus: number,
): DeepLinkAuthorizationDecision {
  const target = sanitizeReturnPath(rawTarget);
  if (sessionStatus >= 200 && sessionStatus < 300) return { kind: "allow", route: target };
  if (sessionStatus === 401 || sessionStatus === 403) {
    return { kind: "login", route: `/login?return_to=${encodeURIComponent(target)}` };
  }
  return { kind: "unavailable" };
}
