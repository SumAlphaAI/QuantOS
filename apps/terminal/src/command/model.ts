import type { BffComponents } from "@sumalpha/api-client";
import type { FreshnessState, RiskPosture } from "@sumalpha/domain-ui/ui101";

export type SessionContext = BffComponents["schemas"]["SessionContext"];
export type CommandSeverity = "critical" | "warning" | "info";

export interface CommandProjection {
  session: SessionContext & {
    workspaceLabel: string;
    accountLabel: string;
    actorInitials: string;
  };
  guard: {
    resourceAvailable: boolean;
    dataAvailable: boolean;
  };
  freshness: { state: FreshnessState; asOf: string };
  risk: { posture: RiskPosture; reason: string };
  priority: Array<{ severity: CommandSeverity; label: string; summary: string; age: string; action: string }>;
  services: Array<{ name: string; status: string; tone: "healthy" | "degraded"; latency: string; availability: number }>;
  activity: Array<{ time: string; actor: string; object: string; status: string; tone: "success" | "neutral" | "info" | "warning"; id: string; detail: string }>;
}
