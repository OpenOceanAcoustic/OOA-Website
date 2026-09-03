import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UseNormalModePageResult } from "../hooks/useNormalModePage";
import { NormalField } from "./NormalField";

describe("NormalField", () => {
  it("recomputes the modal field when the mode limit changes", () => {
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
      commitNumericInput,
    } as unknown as UseNormalModePageResult;

    render(<NormalField page={page} />);
    fireEvent.change(screen.getByLabelText("参与叠加的前 N 阶模态"), { target: { value: "7" } });

    expect(commitNumericInput).toHaveBeenCalledWith("modeLimit", "7");
  });
});
