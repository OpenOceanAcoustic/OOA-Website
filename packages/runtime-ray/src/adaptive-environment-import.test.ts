import { describe, expect, it, vi } from "vitest";
import {
  AdaptiveRayEnvironmentImportError,
  createRayRuntime,
  importAdaptiveRayEnvironment,
} from "./index";
import type { RayImportedEnvironment } from "./public-types";

const validBellhop = [
  "'Adaptive Ray Test'",
  "100.0",
  "1",
  "'CVWT'",
  "0 0.0 200.0",
  "0.0 1500.0 0.0 1.0 0.0 0.0 /",
  "200.0 1500.0 0.0 1.0 0.0 0.0 /",
  "'A' 0.0",
  "200.0 1700.0 0.0 1.8 0.5 0.0 /",
  "1",
  "50.0 /",
  "101",
  "1.0 199.0 /",
  "101",
  "0.1 20.0 /",
  "'IB'",
  "1000",
  "-20.0 20.0 /",
  "0.0 300.0 20.0",
].join("\n");

function envFile(content = validBellhop): File {
  return {
    name: "adaptive.env",
    data: content,
    size: new TextEncoder().encode(content).byteLength,
  } as unknown as File;
}

describe("adaptive Ray environment import", () => {
  it("keeps the native Bellhop2D importer as the first choice", async () => {
    const native = { title: "native" } as RayImportedEnvironment;
    const importEnvironment = vi.fn(async () => native);

    await expect(importAdaptiveRayEnvironment({ importEnvironment }, [
      envFile("not even a canonical Bellhop document"),
    ])).resolves.toEqual({ mode: "native", environment: native });
    expect(importEnvironment).toHaveBeenCalledTimes(1);
  });

  it("falls back to a strictly validated canonical ENV when native parsing fails", async () => {
    const importEnvironment = vi.fn(async () => {
      throw new Error("native parser does not support this option");
    });

    const result = await importAdaptiveRayEnvironment({ importEnvironment }, [envFile()]);
    expect(result.mode).toBe("canonical");
    if (result.mode !== "canonical") throw new Error("expected canonical fallback");
    expect(result.nativeFailure).toBe("native parser does not support this option");
    expect(result.environment).toMatchObject({
      title: "Adaptive Ray Test",
      format: "bellhop-env",
      waterDepthM: 200,
      frequencyHz: 100,
      sourceDepthM: 50,
      maximumRangeKm: 20,
      profilePoints: [[0, 1500], [200, 1500]],
    });
  });

  it("allows demo mode to import a canonical Bellhop ENV", async () => {
    const runtime = createRayRuntime({ demonstration: true });
    try {
      const result = await importAdaptiveRayEnvironment(runtime, [envFile()]);
      expect(result.mode).toBe("canonical");
      if (result.mode !== "canonical") throw new Error("expected demo canonical fallback");
      expect(result.nativeFailure).toContain("演示模式不导入 Bellhop 原生文件");
      expect(result.environment.profilePoints).toEqual([[0, 1500], [200, 1500]]);
    } finally {
      await runtime.dispose();
    }
  });

  it("combines the native and canonical parser reasons when both reject", async () => {
    const nativeError = new Error("native parser detail");
    const importEnvironment = vi.fn(async () => {
      throw nativeError;
    });

    const rejection = await importAdaptiveRayEnvironment(
      { importEnvironment },
      [envFile("'Broken'\n100\n1\n'CVWT'")],
    ).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(AdaptiveRayEnvironmentImportError);
    expect(rejection).toMatchObject({
      nativeError,
      message: expect.stringContaining("Bellhop2D 原生解析失败：native parser detail"),
    });
    expect((rejection as Error).message).toContain("自适应 canonical 解析失败：Bellhop ENV is incomplete");
  });

  it("rejects unsupported sidecars before native parsing can ignore them", async () => {
    const importEnvironment = vi.fn(async () => ({ title: "wrongly accepted" } as RayImportedEnvironment));
    const files = [
      envFile(),
      {
        name: "adaptive.ati",
        data: "unsupported",
        size: 11,
      } as unknown as File,
      {
        name: "adaptive.sbp",
        data: "unsupported",
        size: 11,
      } as unknown as File,
    ];

    await expect(importAdaptiveRayEnvironment({ importEnvironment }, files))
      .rejects.toThrow("adaptive.ati, adaptive.sbp；目前仅支持 .env、.ssp、.bty 和 .json");
    expect(importEnvironment).not.toHaveBeenCalled();
  });

  it("does not repair invalid physical values during fallback", async () => {
    const importEnvironment = vi.fn(async () => {
      throw new Error("native parser rejected invalid speed");
    });
    const invalidSpeed = validBellhop.replace(
      "200.0 1500.0 0.0 1.0 0.0 0.0 /",
      "200.0 -10.0 0.0 1.0 0.0 0.0 /",
    );

    await expect(importAdaptiveRayEnvironment({ importEnvironment }, [envFile(invalidSpeed)]))
      .rejects.toThrow("profilePoints[1] speed must be positive");
  });
});
