import { describe, expect, it } from "vitest";
import { solvePoissonNewton, solvePoissonPicard, solvePoisson } from "./poisson.ts";
import { buildMesh } from "./mesh.ts";
import { uniformNTypeStack } from "../presets/materials.ts";
import { findFermiForBulkPhi, bulkStateAtFermi } from "./bulkNeutral.ts";
import { buildBandReferences } from "./mesh.ts";

describe("poisson solvers", () => {
  it("runs Newton solver with frozen carriers", () => {
    const stack = uniformNTypeStack();
    const mesh = buildMesh(stack, {
      nodesPerNm: 1,
      minNodesPerLayer: 8,
      tol: 1e-6,
      maxGummelIter: 1,
      maxNewtonIter: 50,
      Vapp: 0,
    });
    const { ecRefEv, evRefEv } = buildBandReferences(stack);
    const eF = findFermiForBulkPhi(stack.layers[0]!, 300, ecRefEv[0]!, evRefEv[0]!, 0);
    const bulk = bulkStateAtFermi(stack.layers[0]!, 300, eF, ecRefEv[0]!, evRefEv[0]!);
    const n = mesh.nodes.length;
    const phi = new Float64Array(n).fill(bulk.phiV);
    const nArr = new Float64Array(n).fill(bulk.nM3);
    const pArr = new Float64Array(n).fill(bulk.pM3);
    const eFn = new Float64Array(n).fill(eF);
    const ctx = {
      mesh,
      temperatureK: 300,
      eFnEv: eFn,
      eFpEv: eFn,
      useBoltzmann: false,
      nM3: nArr,
      pM3: pArr,
    };
    const out = solvePoissonNewton(ctx, phi, bulk.phiV, bulk.phiV, 20, 1e-4);
    expect(out[0]).toBeCloseTo(bulk.phiV);
  });

  it("Picard converges for uniform doping", () => {
    const stack = uniformNTypeStack();
    const mesh = buildMesh(stack, {
      nodesPerNm: 1,
      minNodesPerLayer: 8,
      tol: 1e-6,
      maxGummelIter: 1,
      maxNewtonIter: 50,
      Vapp: 0,
    });
    const { ecRefEv, evRefEv } = buildBandReferences(stack);
    const eF = findFermiForBulkPhi(stack.layers[0]!, 300, ecRefEv[0]!, evRefEv[0]!, 0);
    const bulk = bulkStateAtFermi(stack.layers[0]!, 300, eF, ecRefEv[0]!, evRefEv[0]!);
    const n = mesh.nodes.length;
    const eFn = new Float64Array(n).fill(eF);
    const phi = new Float64Array(n).fill(bulk.phiV);
    const ctx = { mesh, temperatureK: 300, eFnEv: eFn, eFpEv: eFn, useBoltzmann: true };
    const out = solvePoissonPicard(ctx, phi, bulk.phiV, bulk.phiV, 50, 1e-6);
    expect(out[n >> 1]).toBeCloseTo(bulk.phiV, 2);
  });

  it("routes non-Boltzmann mode through Picard with one iteration", () => {
    const stack = uniformNTypeStack();
    const mesh = buildMesh(stack, {
      nodesPerNm: 1,
      minNodesPerLayer: 8,
      tol: 1e-6,
      maxGummelIter: 1,
      maxNewtonIter: 50,
      Vapp: 0,
    });
    const { ecRefEv, evRefEv } = buildBandReferences(stack);
    const eF = findFermiForBulkPhi(stack.layers[0]!, 300, ecRefEv[0]!, evRefEv[0]!, 0);
    const bulk = bulkStateAtFermi(stack.layers[0]!, 300, eF, ecRefEv[0]!, evRefEv[0]!);
    const n = mesh.nodes.length;
    const phi = new Float64Array(n).fill(bulk.phiV);
    const nArr = new Float64Array(n).fill(bulk.nM3);
    const pArr = new Float64Array(n).fill(bulk.pM3);
    const eFn = new Float64Array(n).fill(eF);
    const ctx = {
      mesh,
      temperatureK: 300,
      eFnEv: eFn,
      eFpEv: eFn,
      useBoltzmann: false,
      nM3: nArr,
      pM3: pArr,
    };
    const out = solvePoisson(ctx, phi, bulk.phiV, bulk.phiV, 50, 1e-6);
    expect(out[0]).toBeCloseTo(bulk.phiV);
  });

  it("Newton solver updates interior nodes when residual is large", () => {
    const stack = uniformNTypeStack();
    const mesh = buildMesh(stack, {
      nodesPerNm: 1,
      minNodesPerLayer: 8,
      tol: 1e-6,
      maxGummelIter: 1,
      maxNewtonIter: 50,
      Vapp: 0,
    });
    const { ecRefEv, evRefEv } = buildBandReferences(stack);
    const eF = findFermiForBulkPhi(stack.layers[0]!, 300, ecRefEv[0]!, evRefEv[0]!, 0);
    const bulk = bulkStateAtFermi(stack.layers[0]!, 300, eF, ecRefEv[0]!, evRefEv[0]!);
    const n = mesh.nodes.length;
    const phi = new Float64Array(n).fill(0);
    phi[0] = bulk.phiV - 0.2;
    phi[n - 1] = bulk.phiV + 0.2;
    const nArr = new Float64Array(n).fill(bulk.nM3);
    const pArr = new Float64Array(n).fill(bulk.pM3);
    const eFn = new Float64Array(n).fill(eF);
    const ctx = {
      mesh,
      temperatureK: 300,
      eFnEv: eFn,
      eFpEv: eFn,
      useBoltzmann: false,
      nM3: nArr,
      pM3: pArr,
    };
    const out = solvePoissonNewton(ctx, phi, bulk.phiV, bulk.phiV, 20, 1e-4);
    expect(out[n >> 1]).toBeCloseTo(bulk.phiV, 2);
  });
});
