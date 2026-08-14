/** UI-101 fail-closed route guard and shell projection. */

export const ROUTE_GUARD_ORDER = [
  "session",
  "tenant_workspace",
  "rbac_capability",
  "resource",
  "mode",
  "data_freshness",
] as const;

export type RouteGuardStep = (typeof ROUTE_GUARD_ORDER)[number];
export type GuardCheck = "allow" | "deny" | "unknown";

export interface RouteGuardInput {
  checks: Record<RouteGuardStep, GuardCheck>;
}

export interface RouteGuardDecision {
  allowed: boolean;
  completedSteps: RouteGuardStep[];
  stoppedAt?: RouteGuardStep;
  destination?: "/login" | "/unauthorized" | "/offline";
  reason?: string;
}

const FAILURE_DESTINATION: Record<RouteGuardStep, RouteGuardDecision["destination"]> = {
  session: "/login",
  tenant_workspace: "/unauthorized",
  rbac_capability: "/unauthorized",
  resource: "/unauthorized",
  mode: "/unauthorized",
  data_freshness: "/offline",
};

/**
 * Evaluates exactly one guard at a time, in the UI-101 mandated order.
 * A denied or unknown result stops evaluation so later data requests cannot run.
 */
export function evaluateRouteGuard(input: RouteGuardInput): RouteGuardDecision {
  const completedSteps: RouteGuardStep[] = [];
  for (const step of ROUTE_GUARD_ORDER) {
    const result = input.checks[step];
    if (result !== "allow") {
      return {
        allowed: false,
        completedSteps,
        stoppedAt: step,
        destination: FAILURE_DESTINATION[step],
        reason: result === "unknown" ? "未知状态，已安全阻断" : "访问条件不满足",
      };
    }
    completedSteps.push(step);
  }
  return { allowed: true, completedSteps };
}

export type AsyncGuardCheck = () => Promise<GuardCheck>;

/**
 * Runs guard requests sequentially. This is deliberately not Promise.all:
 * a failure must prevent every later resource/mode/data request from firing.
 */
export async function runRouteGuard(
  checks: Record<RouteGuardStep, AsyncGuardCheck>,
): Promise<RouteGuardDecision> {
  const results = {} as Record<RouteGuardStep, GuardCheck>;
  const completedSteps: RouteGuardStep[] = [];
  for (const step of ROUTE_GUARD_ORDER) {
    let result: GuardCheck;
    try {
      result = await checks[step]();
    } catch {
      result = "unknown";
    }
    results[step] = result;
    if (result !== "allow") {
      return {
        allowed: false,
        completedSteps,
        stoppedAt: step,
        destination: FAILURE_DESTINATION[step],
        reason: result === "unknown" ? "未知状态，已安全阻断" : "访问条件不满足",
      };
    }
    completedSteps.push(step);
  }
  return evaluateRouteGuard({ checks: results });
}

export type ShellCapability =
  | "command:read"
  | "research:read"
  | "strategy:read"
  | "portfolio:read"
  | "market:read"
  | "trade:read"
  | "performance:read"
  | "proposal:read"
  | "approval:read"
  | "order:read"
  | "audit:read"
  | "operations:read"
  | "admin:read";

export interface ShellNavigationItem {
  label: string;
  route: string;
  capability: ShellCapability;
  icon: string;
  badge?: number;
}

export const UI101_NAVIGATION: readonly ShellNavigationItem[] = [
  { label: "Command", route: "/command", capability: "command:read", icon: "home" },
  { label: "Research", route: "/research", capability: "research:read", icon: "research" },
  { label: "Strategy", route: "/strategies", capability: "strategy:read", icon: "strategy" },
  { label: "Portfolio", route: "/portfolio", capability: "portfolio:read", icon: "portfolio" },
  { label: "Markets", route: "/markets", capability: "market:read", icon: "markets" },
  { label: "Trade", route: "/trade", capability: "trade:read", icon: "trade" },
  { label: "Performance", route: "/performance", capability: "performance:read", icon: "performance" },
  { label: "Proposals", route: "/proposals", capability: "proposal:read", icon: "proposals" },
  { label: "Approvals", route: "/approvals", capability: "approval:read", icon: "approvals", badge: 3 },
  { label: "Orders", route: "/orders", capability: "order:read", icon: "orders" },
  { label: "Audit", route: "/audit", capability: "audit:read", icon: "audit" },
  { label: "Operations", route: "/operations", capability: "operations:read", icon: "operations" },
  { label: "Admin", route: "/admin/members", capability: "admin:read", icon: "admin" },
] as const;

export function visibleShellNavigation(capabilities: readonly string[]): ShellNavigationItem[] {
  const granted = new Set(capabilities);
  return UI101_NAVIGATION.filter((item) => granted.has(item.capability)).map((item) => ({ ...item }));
}

export type ConnectionState = "live" | "reconnecting" | "offline";
export type FreshnessState = "fresh" | "delayed" | "stale" | "unknown";
export type RiskPosture = "normal" | "elevated" | "critical" | "unknown";

export function writesAllowed(input: {
  connection: ConnectionState;
  freshness: FreshnessState;
  risk: RiskPosture;
  compactViewport: boolean;
}): boolean {
  return (
    input.connection === "live" &&
    input.freshness === "fresh" &&
    input.risk !== "critical" &&
    input.risk !== "unknown" &&
    !input.compactViewport
  );
}
