import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  RayGeometryGlossary,
  TransmissionLossGlossary,
  VelocityGlossary,
} from "./VelocityGlossary";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

const VELOCITY_LABELS = [
  "质点振速",
  "水平质点振速",
  "垂直质点振速",
  "复数声场",
  "复振速幅值",
  "图示振速级",
  "相位",
  "接收网格",
  "OOB 原生结果对象",
  "水平振速原始数据",
  "垂直振速原始数据",
  "交错复数数组",
] as const;

const GLOSSARY_CASES = [
  {
    scope: "velocity",
    Component: VelocityGlossary,
    count: 12,
    source: "PressureField.horizontalVelocityInterleaved · PressureField.verticalVelocityInterleaved",
    trigger: "图示振速级",
    english: "Displayed velocity level",
    explanation: /不是绝对振速级/,
  },
  {
    scope: "ray-geometry",
    Component: RayGeometryGlossary,
    count: 8,
    source: "Bellhop2DResult.rays() · RaySet.pointsM · RaySet.launchAnglesDegrees",
    trigger: "转向点",
    english: "Turning point",
    explanation: /没有接触海面或海底/,
  },
  {
    scope: "transmission-loss",
    Component: TransmissionLossGlossary,
    count: 8,
    source: "Bellhop2DResult.pressureField(0) · PressureField.transmissionLossDb",
    trigger: "相干叠加",
    english: "Coherent summation",
    explanation: /相长与相消干涉/,
  },
] as const;

describe("FloatingGlossary presets", () => {
  it.each(GLOSSARY_CASES)(
    "renders the $scope source and $count native term buttons",
    ({ scope, Component, count, source }) => {
      render(<Component />);

      const glossary = screen.getByTestId(`${scope}-glossary`);
      expect(within(glossary).getByText(source)).toBeInTheDocument();
      const buttons = within(glossary).getAllByRole("button");
      expect(buttons).toHaveLength(count);

      for (const button of buttons) {
        expect(button).toHaveAttribute("type", "button");
        expect(button).toHaveClass("plot-term");
        expect(button).toHaveAttribute("aria-haspopup", "dialog");
        expect(button).toHaveAttribute("aria-controls", `${scope}GlossaryDialog`);
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(button.style.getPropertyValue("--term-duration")).not.toBe("");
        expect(button.style.getPropertyValue("--term-delay")).not.toBe("");
        expect(button.style.getPropertyValue("--term-drift")).not.toBe("");
        expect(button.style.getPropertyValue("--term-x")).toBe("");
        expect(button.style.getPropertyValue("--term-y")).toBe("");
      }
    },
  );

  it("retains all twelve velocity terms", () => {
    render(<VelocityGlossary />);
    const glossary = screen.getByTestId("velocity-glossary");

    for (const label of VELOCITY_LABELS) {
      expect(within(glossary).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("derives unique DOM ids and stream labels from each scope", () => {
    const { container } = render(
      <>
        <VelocityGlossary />
        <RayGeometryGlossary />
        <TransmissionLossGlossary />
      </>,
    );

    const ids = Array.from(container.querySelectorAll<HTMLElement>("[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("velocityGlossaryTitle");
    expect(ids).toContain("ray-geometryGlossaryTitle");
    expect(ids).toContain("transmission-lossGlossaryTitle");

    expect(screen.getByLabelText("质点振速名词流")).toHaveClass("plot-term-stream");
    expect(screen.getByLabelText("声线轨迹名词流")).toHaveClass("plot-term-stream");
    expect(screen.getByLabelText("传播损失名词流")).toHaveClass("plot-term-stream");
  });

  it.each(GLOSSARY_CASES)(
    "opens and closes the $scope explanation, restoring focus",
    ({ scope, Component, trigger: triggerLabel, english, explanation }) => {
      render(<Component />);
      const glossary = screen.getByTestId(`${scope}-glossary`);
      const trigger = within(glossary).getByRole("button", { name: triggerLabel });

      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog", { name: triggerLabel });
      expect(dialog).toHaveAttribute("id", `${scope}GlossaryDialog`);
      expect(within(dialog).getByText(english)).toBeInTheDocument();
      expect(within(dialog).getByText(explanation)).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(document.body.style.overflow).toBe("hidden");

      const close = within(dialog).getByRole("button", {
        name: `关闭“${triggerLabel}”名词解释`,
      });
      expect(close).toHaveClass("plot-glossary-close");
      expect(close).toHaveFocus();
      fireEvent.click(close);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(document.body.style.overflow).toBe("");
    },
  );

  it("supports Escape and backdrop dismissal without closing from dialog content", () => {
    render(<TransmissionLossGlossary />);
    const trigger = screen.getByRole("button", { name: "传播损失" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "传播损失" });
    fireEvent.click(dialog);
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("transmission-loss-glossary-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
