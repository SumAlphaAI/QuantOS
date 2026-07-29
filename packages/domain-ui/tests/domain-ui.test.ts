import { describe, expect, it } from "vitest";

import { describeDomainSurface } from "../src/index.js";

describe("domain-ui", () => {
  it("describes the domain surface", () => {
    expect(describeDomainSurface()).toBe("domain-ui");
  });
});
