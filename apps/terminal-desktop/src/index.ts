import { detectPlatform } from "@sumalpha/platform";
import { renderTerminalShell } from "@sumalpha/terminal";

export function renderDesktopShell(): string {
  return `${renderTerminalShell()}::${detectPlatform("desktop")}`;
}

export * from "./adapter.js";
