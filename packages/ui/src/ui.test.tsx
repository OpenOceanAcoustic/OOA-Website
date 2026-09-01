import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelNavigation, NumberField, RangeField, StatusPill } from ".";

describe("@ooa/ui controlled primitives", () => {
  it("keeps number constraints and reports the parsed value", () => {
    const onValueChange = vi.fn();
    render(<NumberField id="frequency" label="频率" value={100} min={10} max={500} step={10} onValueChange={onValueChange} />);
    const input = screen.getByLabelText("频率");
    expect(input).toHaveAttribute("min", "10");
    expect(input).toHaveAttribute("max", "500");
    expect(input).toHaveAttribute("step", "10");
    fireEvent.change(input, { target: { value: "120" } });
    expect(onValueChange).toHaveBeenCalledWith(120);
  });

  it("associates range output with its input", () => {
    render(<RangeField id="depth" label="深度" value={50} min={0} max={100} step={1} output="50 m" onValueChange={() => undefined} />);
    expect(screen.getByRole("slider", { name: "深度" })).toHaveAttribute("value", "50");
    expect(screen.getByText("50 m")).toHaveAttribute("for", "depth");
  });

  it("renders status and document navigation without client-side routing", () => {
    render(<><StatusPill mode="busy">RUNNING</StatusPill><ModelNavigation items={[{ href: "/", label: "Ray", active: true }]} /></>);
    expect(screen.getByText("RUNNING")).toHaveClass("busy");
    expect(screen.getByRole("link", { name: "Ray" })).toHaveAttribute("href", "/");
  });
});
