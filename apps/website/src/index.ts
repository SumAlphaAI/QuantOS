import { workspaceLabel } from "@sumalpha/config";
import { renderBadge } from "@sumalpha/ui";

export function renderWebsiteShell(): string {
  return renderBadge(`${workspaceLabel}:website`);
}
