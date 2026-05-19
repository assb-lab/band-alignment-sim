import { describe, expect, it } from "vitest";
import { solveStack } from "./gummel.ts";
import { siPnStack } from "../presets/materials.ts";
import type { SolverOptions } from "./types.ts";

const solverOpts: SolverOptions = {
  nodesPerNm: 3,
  minNodesPerLayer: 60,
  tol: 1e-4,
  maxGummelIter: 120,
  maxNewtonIter: 80,
  Vapp: 0,
};

describe("gummel with bias", () => {
  it("produces finite solution at small forward bias", () => {
    const result = solveStack(siPnStack(), { ...solverOpts, Vapp: 0.3 });
    expect(result.converged).toBe(true);
    expect(result.appliedVoltageV).toBeCloseTo(0.3);
    expect(result.bands.efnEv[result.bands.efnEv.length - 1]! - result.bands.efnEv[0]!).toBeCloseTo(0.3);
    expect(result.bands.ecEv[result.bands.ecEv.length - 1]!).not.toBeCloseTo(
      solveStack(siPnStack(), { ...solverOpts, Vapp: 0 }).bands.ecEv.at(-1)!,
    );
  });

  it("solves a non-linear biased potential instead of applying a linear ramp", () => {
    const eq = solveStack(siPnStack(), { ...solverOpts, Vapp: 0 });
    const biased = solveStack(siPnStack(), { ...solverOpts, Vapp: 0.3 });
    const n = biased.phiV.length;
    const d0 = biased.phiV[0]! - eq.phiV[0]!;
    const dL = biased.phiV[n - 1]! - eq.phiV[n - 1]!;
    let maxDeviationFromRamp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const linear = d0 + t * (dL - d0);
      const actual = biased.phiV[i]! - eq.phiV[i]!;
      maxDeviationFromRamp = Math.max(maxDeviationFromRamp, Math.abs(actual - linear));
    }
    expect(maxDeviationFromRamp).toBeGreaterThan(0.02);
  });

});
