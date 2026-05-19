import { describe, expect, it } from "vitest";
import { integratedCharge, isFiniteArray, relativeChange } from "./validation.ts";
import { buildMesh } from "./mesh.ts";
import { siPnStack } from "../presets/materials.ts";

describe("validation", () => {
  it("detects finite arrays", () => {
    expect(isFiniteArray(new Float64Array([1, 2, 3]))).toBe(true);
    expect(isFiniteArray(new Float64Array([1, NaN]))).toBe(false);
  });

  it("computes relative change", () => {
    const a = new Float64Array([1, 2]);
    const b = new Float64Array([1.01, 2]);
    expect(relativeChange(a, b)).toBeCloseTo(0.01, 2);
  });

  it("integrates charge density", () => {
    const mesh = buildMesh(siPnStack(), {
      nodesPerNm: 1,
      minNodesPerLayer: 10,
      tol: 1e-6,
      maxGummelIter: 50,
      maxNewtonIter: 50,
      Vapp: 0,
    });
    const rho = new Float64Array(mesh.nodes.length).fill(1);
    const q = integratedCharge(mesh, rho);
    expect(q).toBeGreaterThan(0);
  });
});
