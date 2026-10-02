// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { StateBadge } from "../src/index";

afterEach(cleanup);
it("React Testing Library observes state updates and unknown-state fallback", () => {
  function Example() {
    const [state, setState] = useState("running");
    return <><StateBadge state={state} /><button onClick={() => setState("future-enum")}>更新</button></>;
  }
  render(<Example />);
  expect(screen.getByLabelText("运行中")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "更新" }));
  expect(screen.queryByLabelText("运行中")).toBeNull();
  expect(screen.getByLabelText("未知/需升级")).toBeTruthy();
});
