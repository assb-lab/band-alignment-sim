import { describe, expect, it } from "vitest";
import { packSimulationResult, unpackSimulationResult } from "./simulationTransfer.ts";
import { solveStack } from "../physics/gummel.ts";
import { siPnStack } from "../presets/materials.ts";
import { DEFAULT_SOLVER_OPTIONS } from "../physics/types.ts";

describe("simulationTransfer", () => {
  it("round-trips simulation results through ArrayBuffers", () => {
    const result = solveStack(siPnStack(), { ...DEFAULT_SOLVER_OPTIONS, tol: 1e-4 });
    const { payload } = packSimulationResult(result);
    const restored = unpackSimulationResult(payload);
    expect(restored.builtInVoltageV).toBeCloseTo(result.builtInVoltageV, 8);
    expect(restored.phiV.length).toBe(result.phiV.length);
    expect(restored.phiV[10]).toBeCloseTo(result.phiV[10]!, 10);
    expect(restored.bands.ecEv[5]).toBeCloseTo(result.bands.ecEv[5]!, 10);
  });
});
