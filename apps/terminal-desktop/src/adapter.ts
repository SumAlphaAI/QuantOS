/**
 * Tauri adapter for the shared Terminal. Desktop mounts the same application
 * assembly with the desktop platform binding — no forked page logic.
 */

import { createTerminalApp, type TerminalApp } from "@sumalpha/terminal";
import type { TerminalClient } from "@sumalpha/api-client";

export function createDesktopTerminalApp(client?: TerminalClient): TerminalApp {
  return createTerminalApp("desktop", client);
}
