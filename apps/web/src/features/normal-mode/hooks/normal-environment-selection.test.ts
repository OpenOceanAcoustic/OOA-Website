import { RuntimeError } from "@ooa/runtime-core";
import { describe, expect, it } from "vitest";
import {
  describeNormalImportError,
  NormalEnvironmentSelectionBuffer,
} from "./normal-environment-selection";

const file = (name: string, contents = "native") => new File([contents], name, { type: "text/plain" });

describe("NormalEnvironmentSelectionBuffer", () => {
  it("keeps a correct same-selection ENV/FLP pair and orders it for the runtime", async () => {
    const buffer = new NormalEnvironmentSelectionBuffer();
    const flp = file("MunkK.flp");
    const env = file("MunkK.env");

    await expect(buffer.accept([flp, env])).resolves.toMatchObject({
      kind: "ready",
      files: [env, flp],
    });
  });

  it("waits and then pairs same-stem files selected in two steps", async () => {
    const buffer = new NormalEnvironmentSelectionBuffer();
    const env = file("MunkK.env");
    const flp = file("munkk.FLP");

    await expect(buffer.accept([env])).resolves.toEqual({
      kind: "waiting",
      message: "已暂存 MunkK.env；等待选择同名的 MunkK.flp。",
    });
    await expect(buffer.accept([flp])).resolves.toMatchObject({
      kind: "ready",
      files: [env, flp],
    });
  });

  it("does not invent a companion for mismatched stems", async () => {
    const buffer = new NormalEnvironmentSelectionBuffer();
    await buffer.accept([file("case-a.env")]);

    const result = await buffer.accept([file("case-b.flp")]);
    expect(result.kind).toBe("waiting");
    expect(result).toMatchObject({ message: expect.stringContaining("case-a.flp") });
    expect(result).toMatchObject({ message: expect.stringContaining("case-b.env") });
  });

  it("recognizes JSON object content before staging a misnamed ENV", async () => {
    const buffer = new NormalEnvironmentSelectionBuffer();
    const result = await buffer.accept([file("field-document.env", "  {\"title\":\"JSON\"}")]);

    expect(result).toMatchObject({ kind: "ready", stem: null });
    if (result.kind !== "ready") throw new Error("expected ready JSON selection");
    expect(result.files[0]?.name).toBe("field-document.json");
  });

  it("keeps parser failures available for a corrected counterpart retry", async () => {
    const buffer = new NormalEnvironmentSelectionBuffer();
    const env = file("retry.env");
    const firstFlp = file("retry.flp", "bad");
    const selection = await buffer.accept([env, firstFlp]);
    expect(selection.kind).toBe("ready");

    const replacement = file("retry.flp", "fixed");
    await expect(buffer.accept([replacement])).resolves.toMatchObject({
      kind: "ready",
      files: [env, replacement],
    });
  });
});

it("includes the native parser cause in the user-facing Normal import error", () => {
  const cause = new TypeError("line 17: invalid bottom boundary option");
  const error = new RuntimeError("INPUT_INVALID", "Kraken ENV/FLP 无法解析", { cause });

  expect(describeNormalImportError(error)).toBe(
    "Kraken ENV/FLP 无法解析：line 17: invalid bottom boundary option",
  );
});
