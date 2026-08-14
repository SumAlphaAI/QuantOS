import { describe, expect, it } from "vitest";

import { authorizeDeepLinkTarget } from "../src/auth/deep-link";

describe("desktop deep-link reauthorization gate", () => {
  it("allows a sanitized target only after a successful BFF session check", () => {
    expect(authorizeDeepLinkTarget("/command", 200)).toEqual({ kind: "allow", route: "/command" });
  });

  it("routes 401/403 through login while preserving only the sanitized target", () => {
    expect(authorizeDeepLinkTarget("/command", 401)).toEqual({
      kind: "login",
      route: "/login?return_to=%2Fcommand",
    });
    expect(authorizeDeepLinkTarget("https://evil.example/steal", 403)).toEqual({
      kind: "login",
      route: "/login?return_to=%2Fcommand",
    });
  });

  it("fails closed on BFF/network-class failures", () => {
    expect(authorizeDeepLinkTarget("/command", 429)).toEqual({ kind: "unavailable" });
    expect(authorizeDeepLinkTarget("/command", 503)).toEqual({ kind: "unavailable" });
  });
});
