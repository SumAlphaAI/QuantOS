import { describe, expect, it } from "vitest";

import { renderTerminalShell } from "../src/index.js";

describe("terminal shell", () => {
  it("renders the shared terminal shell", () => {
    expect(renderTerminalShell()).toBe("domain-ui::api-client::web");
  });
});
