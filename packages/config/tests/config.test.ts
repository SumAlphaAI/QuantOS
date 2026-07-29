import { describe, expect, it } from "vitest";

import { workspaceLabel } from "../src/index.js";

describe("config", () => {
  it("exports the workspace label", () => {
    expect(workspaceLabel).toBe("sumalpha-quantos");
  });
});
