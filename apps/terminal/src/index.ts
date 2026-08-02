import { createApiClientName } from "@sumalpha/api-client";
import { describeDomainSurface } from "@sumalpha/domain-ui";
import { detectPlatform } from "@sumalpha/platform";

export function renderTerminalShell(): string {
  return `${describeDomainSurface()}::${createApiClientName()}::${detectPlatform("web")}`;
}

export * from "./app.js";
