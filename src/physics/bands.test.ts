import { describe, expect, it } from "vitest";
import { electricField } from "./bands.ts";
import { buildMesh } from "./mesh.ts";
import { uniformNTypeStack } from "../presets/materials.ts";

describe("bands extras", () => {
  it("computes field on single-node mesh", () => {
    const mesh = buildMesh(uniformNTypeStack(), {
      nodesPerNm: 0.1,
      minNodesPerLayer: 1,
      tol: 1e-6,
      maxGummelIter: 1,
      maxNewtonIter: 10,
      Vapp: 0,
    });
    const phi = new Float64Array(mesh.nodes.length).fill(0.1);
    const E = electricField(mesh, phi);
    expect(E.length).toBe(mesh.nodes.length);
  });

  it("returns zero field when only one mesh node exists", () => {
    const mesh = {
      nodes: [
        {
          xM: 0,
          layerIndex: 0,
          epsilonR: 11.7,
          niM3: 1e16,
          NcM3: 1e16,
          NvM3: 1e16,
          NdM3: 0,
          NaM3: 0,
          ecRefEv: 4.05,
          evRefEv: 2.93,
        },
      ],
      dxM: [],
      lengthM: 1e-6,
    };
    const E = electricField(mesh, new Float64Array([0.5]));
    expect(E[0]).toBe(0);
  });
});
