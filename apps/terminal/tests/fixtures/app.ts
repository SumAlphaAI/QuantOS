import { createScenarioTerminalClient } from "./scenarios/terminal.js";
import { createTerminalScenario } from "./scenarios/terminal.js";
import { type TerminalClient } from "@sumalpha/api-client";
import { createTerminalApp as assemble } from "../../src/app.js";
import type { PlatformKind } from "@sumalpha/platform";
export type { TerminalApp } from "../../src/app.js";
export const createTerminalApp = (kind: PlatformKind, client = createScenarioTerminalClient(createTerminalScenario()) as TerminalClient) => assemble(kind, client);
