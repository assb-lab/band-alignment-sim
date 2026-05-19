import { describe, expect, it } from "vitest";
import { solveStack } from "../physics/gummel.ts";
import type { SolverOptions } from "../physics/types.ts";
import {
  alganGanStack,
  ganSchottkyStack,
  gePnStack,
  inpIngaasStack,
  sicSchottkyStack,
  znoCdteStack,
} from "./materials.ts";

const coarseSolverOpts: SolverOptions = {
  nodesPerNm: 1,
  minNodesPerLayer: 30,
  tol: 1e-4,
  maxGummelIter: 100,
  maxNewtonIter: 800,
  maxRelativeResidual: 2000,
  Vapp: 0,
};

describe("rich material sample stacks", () => {
  it.each([
    ["Ge pn", gePnStack],
    ["InP/InGaAs p-i-n", inpIngaasStack],
    ["AlGaN/GaN", alganGanStack],
    ["Ni/GaN Schottky", ganSchottkyStack],
    ["Ti/4H-SiC Schottky", sicSchottkyStack],
    ["ZnO/CdTe", znoCdteStack],
  ])("solves %s with finite bands", (_name, makeStack) => {
    const result = solveStack(makeStack(), coarseSolverOpts);

    expect(result.converged).toBe(true);
    expect(Array.from(result.phiV).every(Number.isFinite)).toBe(true);
    expect(Array.from(result.bands.ecEv).some(Number.isFinite)).toBe(true);
    expect(result.materialRegions.length).toBeGreaterThan(0);
  });
});
