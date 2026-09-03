import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UsePePageResult } from "../hooks/usePePage";
import { PeConvergence } from "./PeConvergence";

describe("PeConvergence", () => {
  it("selects a new computed field when the Padé term count changes", () => {
    const selectPade = vi.fn();
    const page = {
      parameters: { nPade: "4" },
      result: { metrics: { deltaRmsDb: 1.25, deltaMaxDb: 3.5 } },
      solveBusy: false,
      canvases: { convergence: createRef<HTMLCanvasElement>() },
      selectPade,
      selectPadeFromConvergence: vi.fn(),
    } as unknown as UsePePageResult;

    render(<PeConvergence page={page} />);
    fireEvent.change(screen.getByLabelText("Padé 项数 nPade"), { target: { value: "8" } });

    expect(selectPade).toHaveBeenCalledWith(8);
  });
});
