import { expect, test } from "@playwright/test";

const BFF_SESSION = "http://localhost:4010/v1/session";
const session = {
  actorId: "11111111-2222-4333-8444-555555555555",
  tenantId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  workspaceId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
  accountId: "6f708192-a3b4-4d5e-8f6a-7b8c9d0e1f2a",
  mode: "paper",
  environment: "staging",
  capabilities: ["command:read"],
  mfaState: "verified",
  expiresAt: "2026-08-14T06:00:00Z",
};

test.describe("Tauri deep-link reauthorization page", () => {
  test("BFF session authorized: navigates to the sanitized target", async ({ page }) => {
    await page.route(BFF_SESSION, (route) => route.fulfill({ status: 200, json: session }));
    await page.goto("/auth/deep-link?return_to=/command");
    await page.waitForURL((url) => url.pathname === "/command");
    await expect(page.locator('main[data-smoke="route-/command"]')).toBeVisible();
  });

  test("BFF session unauthorized: forces login before the target", async ({ page }) => {
    await page.route(BFF_SESSION, (route) =>
      route.fulfill({
        status: 401,
        json: {
          code: "UNAUTHORIZED",
          message: "Session expired.",
          correlationId: "9a1c4e60-2d3b-4c5f-8a9e-1b2c3d4e5f60",
        },
      }),
    );
    await page.goto("/auth/deep-link?return_to=/command");
    await page.waitForURL((url) => url.pathname === "/login");
    expect(new URL(page.url()).searchParams.get("return_to")).toBe("/command");
  });

  test("malicious target is replaced with the safe default", async ({ page }) => {
    await page.route(BFF_SESSION, (route) => route.fulfill({ status: 200, json: session }));
    await page.goto("/auth/deep-link?return_to=https://evil.example/steal");
    await page.waitForURL((url) => url.pathname === "/command");
    expect(page.url()).not.toContain("evil.example");
  });

  test("BFF unavailable: fails closed without opening the target", async ({ page }) => {
    await page.route(BFF_SESSION, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/auth/deep-link?return_to=/command");
    await expect(page.locator('main [role="alert"]')).toContainText("无法验证会话");
    expect(new URL(page.url()).pathname).toBe("/auth/deep-link");
  });
});
