import { describe, expect, it } from "vitest";

import { renderDesktopShell } from "../src/index.js";

describe("desktop shell", () => {
  it("wraps the shared terminal shell", () => {
    expect(renderDesktopShell()).toBe("domain-ui::api-client::web::desktop");
  });
});
