import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NormalTheorySection } from "./NormalTheorySection";

const renderers = vi.hoisted(() => ({
  renderDispersion: vi.fn(),
  renderStandingModes: vi.fn(),
  renderTravelingModes: vi.fn(),
}));

vi.mock("../canvas/normal-theory-renderer", () => renderers);

describe("NormalTheorySection", () => {
  it("renders four linked diagrams and applies the teaching controls", async () => {
    const { container } = render(<NormalTheorySection />);

    expect(container.querySelectorAll(".normal-theory-card")).toHaveLength(3);
    expect(container.querySelectorAll("canvas")).toHaveLength(3);
    expect(container.querySelector(".normal-theory-formula math")).not.toBeNull();

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0]!, { target: { value: "250" } });
    fireEvent.change(sliders[1]!, { target: { value: "6" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "deep-channel" } });

    expect(screen.getByText("250 Hz")).toBeInTheDocument();
    expect(screen.getByText("前 6 阶")).toBeInTheDocument();
    await waitFor(() => {
      expect(renderers.renderDispersion).toHaveBeenLastCalledWith(
        expect.any(HTMLCanvasElement),
        expect.objectContaining({ frequencyHz: 250, modeCount: 6, profile: "deep-channel" }),
        expect.any(Number),
      );
    });
  });
});
