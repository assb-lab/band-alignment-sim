import { describe, expect, it } from "vitest";
import { buildMesh, buildBandReferences, nodeCount } from "./mesh.ts";
import { nmToM } from "./units.ts";
import { siHetero3Stack, siPnStack, siSchottkyNStack } from "../presets/materials.ts";
import { semiconductorLayers } from "./stackContacts.ts";

describe("mesh", () => {
  it("builds mesh spanning total thickness", () => {
    const stack = siPnStack();
    const mesh = buildMesh(stack, { nodesPerNm: 2, minNodesPerLayer: 20, tol: 1e-6, maxGummelIter: 50, maxNewtonIter: 50, Vapp: 0 });
    const total = stack.layers.reduce((s, l) => s + l.thicknessM, 0);
    expect(mesh.lengthM).toBeCloseTo(total);
    expect(nodeCount(mesh)).toBeGreaterThan(40);
  });

  it("tracks band references from each layer affinity and band gap", () => {
    const stack = siHetero3Stack();
    const refs = buildBandReferences(stack);
    expect(refs.ecRefEv).toHaveLength(3);
    const jump = refs.ecRefEv[1]! - refs.ecRefEv[0]!;
    expect(jump).toBeCloseTo(0.4, 2);
    const originalThirdEc = refs.ecRefEv[2]!;
    stack.layers[2]!.electronAffinityEv = 4.25;
    stack.layers[2]!.bandGapEv = 1.55;
    const changedRefs = buildBandReferences(stack);
    expect(changedRefs.ecRefEv[2]).not.toBeCloseTo(originalThirdEc);
    expect(changedRefs.ecRefEv[2]).toBeCloseTo(-4.25);
    expect(changedRefs.evRefEv[2]).toBeCloseTo(-5.8);
  });

  it("ignores metal rows when building mesh length", () => {
    const stack = siSchottkyNStack();
    const mesh = buildMesh(stack, {
      nodesPerNm: 2,
      minNodesPerLayer: 20,
      tol: 1e-6,
      maxGummelIter: 50,
      maxNewtonIter: 50,
      Vapp: 0,
    });
    const semOnly = semiconductorLayers(stack).reduce((s, l) => s + l.thicknessM, 0);
    expect(mesh.lengthM).toBeCloseTo(semOnly);
  });

  it("does not change semiconductor mesh when metal thickness changes", () => {
    const base = siSchottkyNStack();
    const thickMetal = siSchottkyNStack();
    thickMetal.layers[0]!.thicknessM = nmToM(100);
    const options = {
      nodesPerNm: 2,
      minNodesPerLayer: 20,
      tol: 1e-6,
      maxGummelIter: 50,
      maxNewtonIter: 50,
      Vapp: 0,
    };

    const baseMesh = buildMesh(base, options);
    const changedMesh = buildMesh(thickMetal, options);
    expect(changedMesh.lengthM).toBeCloseTo(baseMesh.lengthM);
    expect(nodeCount(changedMesh)).toBe(nodeCount(baseMesh));
  });

  it("places interface nodes between layers", () => {
    const stack = siPnStack();
    const mesh = buildMesh(stack, { nodesPerNm: 1, minNodesPerLayer: 10, tol: 1e-6, maxGummelIter: 50, maxNewtonIter: 50, Vapp: 0 });
    const mid = mesh.nodes.find((n) => Math.abs(n.xM - nmToM(500)) < 1e-12);
    expect(mid).toBeDefined();
  });
});
