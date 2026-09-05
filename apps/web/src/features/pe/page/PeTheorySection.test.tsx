import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PeTheorySection } from "./PeTheorySection";

const renderer = vi.hoisted(() => ({ renderPeMarch: vi.fn() }));

vi.mock("../canvas/pe-theory-renderer", () => renderer);

describe("PeTheorySection", () => {
  it("presents one range-marching display and animation controls", () => {
    const { container } = render(<PeTheorySection />);

    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(container.querySelector(".pe-theory-formula math")).not.toBeNull();
    expect(screen.getByText("Padé(n)")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "暂停递推" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "播放递推" })).toBeInTheDocument();
    expect(renderer.renderPeMarch).toHaveBeenCalled();
  });
});
