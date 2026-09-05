import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UsePePageResult } from "../hooks/usePePage";
import { PeConvergence } from "./PeConvergence";

afterEach(cleanup);

function setup() {
  const setNumericInput = vi.fn();
  const selectPade = vi.fn();
  const page = {
    parameters: { nPade: "4" },
    result: {
      parameters: { nPade: 4 },
      metrics: { deltaRmsDb: 1.25, deltaMaxDb: 3.5 },
    },
    solveBusy: false,
    canvases: { convergence: createRef<HTMLCanvasElement>() },
    selectPade,
    setNumericInput,
    selectPadeFromConvergence: vi.fn(),
  } as unknown as UsePePageResult;

  render(<PeConvergence page={page} />);
  const slider = screen.getByLabelText("Padé 项数 nPade");
  const preview = (value: string) => {
    fireEvent.input(slider, { target: { value } });
  };
  return {
    preview,
    selectPade,
    setNumericInput,
    slider,
  };
}

describe("PeConvergence", () => {
  it("previews pointer input and commits once when the pointer is released", () => {
    const { preview, selectPade, setNumericInput, slider } = setup();

    preview("7");

    expect(setNumericInput).toHaveBeenCalledWith("nPade", "7");
    expect(selectPade).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    fireEvent.blur(slider);

    expect(selectPade).toHaveBeenCalledTimes(1);
    expect(selectPade).toHaveBeenCalledWith(7);
  });

  it("commits keyboard input on keyup without repeating it on blur", () => {
    const { preview, selectPade, setNumericInput, slider } = setup();

    slider.focus();
    preview("8");
    expect(setNumericInput).toHaveBeenCalledWith("nPade", "8");
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    fireEvent.blur(slider);

    expect(selectPade).toHaveBeenCalledTimes(1);
    expect(selectPade).toHaveBeenCalledWith(8);
  });

  it("uses blur as a fallback final interaction", () => {
    const { preview, selectPade, setNumericInput, slider } = setup();

    preview("6");
    slider.focus();
    fireEvent.blur(slider);
    expect(setNumericInput).toHaveBeenCalledWith("nPade", "6");

    expect(selectPade).toHaveBeenCalledTimes(1);
    expect(selectPade).toHaveBeenCalledWith(6);
  });
});
