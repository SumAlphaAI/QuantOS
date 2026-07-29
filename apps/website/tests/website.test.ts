import { describe, expect, it } from "vitest";

import { renderWebsiteShell } from "../src/index.js";

describe("website shell", () => {
  it("renders the website badge", () => {
    expect(renderWebsiteShell()).toBe("[sumalpha-quantos:website]");
  });
});
