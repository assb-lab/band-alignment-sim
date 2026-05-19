import { describe, expect, it } from "vitest";
import { solveStack } from "./gummel.ts";
import { analyticVbi } from "./bulkNeutral.ts";
import { layerNi } from "./intrinsic.ts";
import { nmToM, perCm3ToPerM3 } from "./units.ts";
import {
  makeLayer,
  ALGAAS_MATERIAL,
  GAAS_MATERIAL,
  siHetero3Stack,
  siPnStack,
  uniformNTypeStack,
  SI_MATERIAL,
} from "../presets/materials.ts";
import type { LayerStack, SolverOptions } from "./types.ts";

const solverOpts: SolverOptions = {
  nodesPerNm: 2,
  minNodesPerLayer: 40,
  tol: 1e-4,
  maxGummelIter: 100,
  maxNewtonIter: 800,
  Vapp: 0,
};

function siPnpStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "p-Si L",
        thicknessM: nmToM(500),
        NaM3: perCm3ToPerM3(1e16),
        NdM3: 0,
      }),
      makeLayer({
        label: "n-Si",
        thicknessM: nmToM(500),
        NdM3: perCm3ToPerM3(1e16),
        NaM3: 0,
      }),
      makeLayer({
        label: "p-Si R",
        thicknessM: nmToM(500),
        NaM3: perCm3ToPerM3(1e16),
        NdM3: 0,
      }),
    ],
  };
}

describe("equilibrium Poisson solver", () => {
  it("yields nearly constant phi for uniform n-type slab", () => {
    const result = solveStack(uniformNTypeStack(), solverOpts);
    const phi = result.phiV;
    const range = Math.max(...phi) - Math.min(...phi);
    expect(range).toBeLessThan(0.01);
  });

  it("computes built-in voltage within 5% of analytic pn value", () => {
    const stack = siPnStack();
    const result = solveStack(stack, solverOpts);
    const ni = layerNi(SI_MATERIAL, 300);
    const vbiAnalytic = analyticVbi(
      perCm3ToPerM3(1e16),
      perCm3ToPerM3(1e16),
      ni,
      300,
    );
    const relErr = Math.abs(result.builtInVoltageV - vbiAnalytic) / vbiAnalytic;
    expect(relErr).toBeLessThan(0.05);
    expect(result.converged).toBe(true);
  });

  it("shows pn junction band bending (non-linear Ec)", () => {
    const stack = siPnStack();
    const result = solveStack(stack, solverOpts);
    const mesh = result.mesh;
    const n = mesh.nodes.length;
    let linearDev = 0;
    const ec0 = result.bands.ecEv[0]!;
    const ecEnd = result.bands.ecEv[n - 1]!;
    for (let i = 0; i < n; i++) {
      const chord = ec0 + (i / (n - 1)) * (ecEnd - ec0);
      linearDev = Math.max(linearDev, Math.abs(result.bands.ecEv[i]! - chord));
    }
    expect(linearDev).toBeGreaterThan(0.1);

    // Curvature peaks near depletion edges, not always at the geometric midpoint.
    const xNm = result.mesh.nodes.map((node) => node.xM * 1e9);
    const halfWidthNm = (xNm[n - 1]! - xNm[0]!) * 0.15;
    let edgeDev = 0;
    for (let i = 0; i < n; i++) {
      const nearEdge =
        Math.abs(xNm[i]! - xNm[0]!) < halfWidthNm ||
        Math.abs(xNm[i]! - xNm[n - 1]!) < halfWidthNm;
      if (!nearEdge) continue;
      const chord = ec0 + (i / (n - 1)) * (ecEnd - ec0);
      edgeDev = Math.max(edgeDev, Math.abs(result.bands.ecEv[i]! - chord));
    }
    expect(edgeDev).toBeGreaterThan(0.05);
    expect(result.builtInVoltageV).toBeGreaterThan(0.5);
  });

  it("converges for a p-Si / n-Si / p-Si stack with two homojunctions", () => {
    const result = solveStack(siPnpStack(), solverOpts);
    expect(result.converged).toBe(true);
    expect(result.materialRegions.map((region) => region.label)).toEqual([
      "p-Si L",
      "n-Si",
      "p-Si R",
    ]);
    expect(Array.from(result.phiV).every(Number.isFinite)).toBe(true);
    expect(Array.from(result.bands.ecEv).every(Number.isFinite)).toBe(true);

    const leftEc = result.bands.ecEv[0]!;
    const middleNode = result.mesh.nodes.findIndex((node) => node.xM > nmToM(740));
    const rightEc = result.bands.ecEv[result.bands.ecEv.length - 1]!;
    expect(middleNode).toBeGreaterThan(0);
    expect(leftEc - result.bands.ecEv[middleNode]!).toBeGreaterThan(0.5);
    expect(rightEc - result.bands.ecEv[middleNode]!).toBeGreaterThan(0.5);
  });

  it("preserves hetero Ec jump from layer electron affinity in 3-layer stack", () => {
    const stack = siHetero3Stack();
    const result = solveStack(stack, solverOpts);
    const mesh = result.mesh;
    let ifaceIdx = 0;
    for (let i = 1; i < mesh.nodes.length; i++) {
      if (mesh.nodes[i]!.layerIndex !== mesh.nodes[i - 1]!.layerIndex) {
        ifaceIdx = i;
        break;
      }
    }
    const ecJump = result.bands.ecEv[ifaceIdx]! - result.bands.ecEv[ifaceIdx - 1]!;
    expect(ecJump).toBeCloseTo(0.4, 2);
    const phiJump = Math.abs(result.phiV[ifaceIdx]! - result.phiV[ifaceIdx - 1]!);
    expect(phiJump).toBeLessThan(0.01);

    const changedStack = siHetero3Stack();
    changedStack.layers[2]!.electronAffinityEv = 4.1;
    changedStack.layers[2]!.bandGapEv = 1.45;
    const changed = solveStack(changedStack, { ...solverOpts, maxRelativeResidual: 2000 });
    const secondIfaceIdx = changed.mesh.nodes.findIndex(
      (node, i) => i > 0 && node.layerIndex !== changed.mesh.nodes[i - 1]!.layerIndex && node.layerIndex === 2,
    );
    expect(secondIfaceIdx).toBeGreaterThan(0);
    const changedEcJump =
      changed.bands.ecEv[secondIfaceIdx]! - changed.bands.ecEv[secondIfaceIdx - 1]!;
    expect(changedEcJump).not.toBeCloseTo(
      -ecJump,
      2,
    );
    expect(changedEcJump).toBeLessThan(-0.42);
    expect(changedEcJump).toBeGreaterThan(-0.46);
    const changedEv = Array.from(changed.preContactBands.evEv).findLast(Number.isFinite)!;
    const baseEv = Array.from(result.preContactBands.evEv).findLast(Number.isFinite)!;
    expect(changedEv).not.toBeCloseTo(
      baseEv,
      2,
    );
  });

  it("keeps the physical conduction-band offset direction for n-AlGaAs / n-GaAs", () => {
    const stack: LayerStack = {
      temperatureK: 300,
      layers: [
        makeLayer({
          label: "n-AlGaAs",
          thicknessM: nmToM(300),
          ...ALGAAS_MATERIAL,
          NdM3: perCm3ToPerM3(1e16),
          NaM3: 0,
        }),
        makeLayer({
          label: "n-GaAs",
          thicknessM: nmToM(300),
          ...GAAS_MATERIAL,
          NdM3: perCm3ToPerM3(1e16),
          NaM3: 0,
        }),
      ],
    };
    const result = solveStack(stack, solverOpts);
    const mesh = result.mesh;
    const ifaceIdx = mesh.nodes.findIndex(
      (node, i) => i > 0 && node.layerIndex !== mesh.nodes[i - 1]!.layerIndex,
    );
    expect(ifaceIdx).toBeGreaterThan(0);

    const ecJump = result.bands.ecEv[ifaceIdx]! - result.bands.ecEv[ifaceIdx - 1]!;
    expect(ecJump).toBeCloseTo(-0.4, 2);
    expect(Math.abs(result.bands.efnEv[ifaceIdx]! - result.bands.efnEv[0]!)).toBeLessThan(1e-9);
  });
});
