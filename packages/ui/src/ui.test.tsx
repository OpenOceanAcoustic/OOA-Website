import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, RuntimeBanner } from "./index";

describe("UI public interface", () => {
  it("keeps domain-neutral actions and runtime status accessible", () => {
    render(<><RuntimeBanner state="ready" detail="WASM 已就绪" /><Button>运行计算</Button></>);
    expect(screen.getByRole("status")).toHaveTextContent("WASM 已就绪");
    expect(screen.getByRole("button", { name: "运行计算" })).toBeEnabled();
  });
});
