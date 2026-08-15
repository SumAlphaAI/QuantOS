import { describe, expect, it } from "vitest";

import { detectPlatform, shouldExposeBrowserSettings } from "../src/index.js";

describe("platform", () => {
  it("returns the requested platform", () => {
    expect(detectPlatform("desktop")).toBe("desktop");
  });

  it("exposes the P17 browser settings surface only on Web", () => {
    expect(shouldExposeBrowserSettings("web")).toBe(true);
    expect(shouldExposeBrowserSettings("desktop")).toBe(false);
  });
});
