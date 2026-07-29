import { describe, expect, it } from "vitest";

import { detectPlatform } from "../src/index.js";

describe("platform", () => {
  it("returns the requested platform", () => {
    expect(detectPlatform("desktop")).toBe("desktop");
  });
});
