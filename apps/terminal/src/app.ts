/**
 * Shared Terminal view-model assembly with an explicitly supplied typed client.
 * Legacy default backend assembly lives only under tests/fixtures.
 */

import {
  type TerminalClient,
} from "@sumalpha/api-client";
import {
  buildAppShell,
  pageMetaFor,
  visibleHighRiskActions,
  viewportForWidth,
  type AppShellModel,
  type RiskActionKind,
  type TerminalRoute,
} from "@sumalpha/domain-ui";
import {
  platformCapabilities,
  type PlatformCapabilities,
  type PlatformKind,
} from "@sumalpha/platform";

export interface TerminalApp {
  client: TerminalClient;
  platform: PlatformCapabilities;
  shell(route: TerminalRoute, viewportWidthPx: number, modeBanner: string): AppShellModel;
  actionsFor(route: TerminalRoute, viewportWidthPx: number): RiskActionKind[];
}

export function createTerminalApp(
  platformKind: PlatformKind,
  client: TerminalClient,
): TerminalApp {
  const platform = platformCapabilities(platformKind);
  return {
    client,
    platform,
    shell(route, viewportWidthPx, modeBanner) {
      return buildAppShell(route, viewportForWidth(viewportWidthPx), modeBanner);
    },
    actionsFor(route, viewportWidthPx) {
      return visibleHighRiskActions(pageMetaFor(route), viewportForWidth(viewportWidthPx));
    },
  };
}
