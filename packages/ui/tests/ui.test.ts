import { describe, expect, it } from "vitest";

import { renderBadge } from "../src/index.js";

describe("ui", () => {
  it("renders a badge", () => {
    expect(renderBadge("sample")).toBe("[sample]");
  });
});
