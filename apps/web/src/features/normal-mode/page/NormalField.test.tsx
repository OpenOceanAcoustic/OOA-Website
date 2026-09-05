import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UseNormalModePageResult } from "../hooks/useNormalModePage";
import { NormalField } from "./NormalField";

describe("NormalField", () => {
  it("previews range input and commits the latest value once when interaction finishes", () => {
    const setNumericInput = vi.fn();
    const commitNumericInput = vi.fn();
    const page = {
      parameters: { modeLimit: "4" },
      result: {
        field: { activeModeCount: 4, columns: 2, rows: 2 },
        modes: { count: 13 },
        environment: { sourceDepthM: 50 },
        runtime: { computeMs: 12 },
        metrics: { deltaRmsDb: 1.25 },
      },
      selectedMode: 0,
      modeMaximum: 13,
      fieldView: "sum",
      solveBusy: false,
      canvases: { field: createRef<HTMLCanvasElement>() },
      setFieldView: vi.fn(),
      setNumericInput,
      commitNumericInput,
    } as unknown as UseNormalModePageResult;

    render(<NormalField page={page} />);
    const modeLimit = screen.getByLabelText("参与叠加的前 N 阶模态");

    fireEvent.input(modeLimit, { target: { value: "6" } });
    fireEvent.input(modeLimit, { target: { value: "7" } });

    expect(setNumericInput).toHaveBeenNthCalledWith(1, "modeLimit", "6");
    expect(setNumericInput).toHaveBeenNthCalledWith(2, "modeLimit", "7");
    expect(commitNumericInput).not.toHaveBeenCalled();

    fireEvent.pointerUp(modeLimit);

    expect(commitNumericInput).toHaveBeenCalledWith("modeLimit", "7");
    expect(commitNumericInput).toHaveBeenCalledTimes(1);

    fireEvent.blur(modeLimit);
    expect(commitNumericInput).toHaveBeenCalledTimes(1);

    fireEvent.input(modeLimit, { target: { value: "8" } });
    fireEvent.keyUp(modeLimit, { key: "ArrowRight" });
    expect(commitNumericInput).toHaveBeenNthCalledWith(2, "modeLimit", "8");

    fireEvent.input(modeLimit, { target: { value: "9" } });
    fireEvent.blur(modeLimit);
    expect(commitNumericInput).toHaveBeenNthCalledWith(3, "modeLimit", "9");
  });
});
