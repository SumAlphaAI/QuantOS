/**
 * Shared Terminal application assembly: binds the BFF typed client, App Shell,
 * and page view models. The web app mounts this directly; the desktop shell
 * mounts it through the Tauri adapter with a different platform binding.
 */

import {
  InMemoryTerminalBackend,
  createTerminalClient,
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
  client?: TerminalClient,
): TerminalApp {
  const resolvedClient = client ?? createTerminalClient(new InMemoryTerminalBackend());
  const platform = platformCapabilities(platformKind);
  return {
    client: resolvedClient,
    platform,
    shell(route, viewportWidthPx, modeBanner) {
      return buildAppShell(route, viewportForWidth(viewportWidthPx), modeBanner);
    },
    actionsFor(route, viewportWidthPx) {
      return visibleHighRiskActions(pageMetaFor(route), viewportForWidth(viewportWidthPx));
    },
  };
}
