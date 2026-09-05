import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VelocityGlossary } from "./VelocityGlossary";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

const TERM_LABELS = [
  "质点振速",
  "水平质点振速",
  "垂直质点振速",
  "复数声场",
  "复振速幅值",
  "图示振速级",
  "相位",
  "接收网格",
  "OOB 原生 ResultHandle",
  "horizontal_velocity",
  "vertical_velocity",
  "交错复数数组",
] as const;

describe("VelocityGlossary", () => {
  it("renders twelve stable, native term buttons and the ResultHandle source", () => {
    render(<VelocityGlossary />);

    expect(screen.getByText("OOB 原生结果句柄")).toBeInTheDocument();
    expect(
      screen.getByText("ResultHandle.horizontal_velocity · ResultHandle.vertical_velocity"),
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(12);
    for (const label of TERM_LABELS) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-haspopup", "dialog");
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens the matching explanation with a pointer click", () => {
    render(<VelocityGlossary />);
    const trigger = screen.getByRole("button", { name: "图示振速级" });

    fireEvent.pointerDown(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "图示振速级" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Displayed velocity level")).toBeInTheDocument();
    expect(screen.getByText(/不是绝对振速级/)).toBeInTheDocument();
    expect(screen.getByText(/色标和悬停读数/)).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "关闭“图示振速级”名词解释" })).toHaveFocus();
  });

  it("closes from the close button and restores page scrolling", () => {
    render(<VelocityGlossary />);
    const trigger = screen.getByRole("button", { name: "复数声场" });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "关闭“复数声场”名词解释" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and restores focus to the triggering term", () => {
    render(<VelocityGlossary />);
    const trigger = screen.getByRole("button", { name: "horizontal_velocity" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes only when the backdrop itself is clicked", () => {
    render(<VelocityGlossary />);
    fireEvent.click(screen.getByRole("button", { name: "接收网格" }));
    const dialog = screen.getByRole("dialog", { name: "接收网格" });

    fireEvent.click(dialog);
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("velocity-glossary-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
