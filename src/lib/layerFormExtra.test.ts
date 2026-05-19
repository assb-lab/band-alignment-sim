import { describe, expect, it } from "vitest";
import { createEmptyRow, layerToRow, rowToLayer } from "./layerForm.ts";
import { ConvergenceError } from "../physics/types.ts";
import { dopingChargeIntegral } from "../physics/validation.ts";
import { buildMesh } from "../physics/mesh.ts";
import { uniformNTypeStack } from "../presets/materials.ts";

describe("layerForm extras", () => {
  it("creates labeled empty row", () => {
    expect(createEmptyRow("X").label).toBe("X");
  });

  it("round-trips layer with direct ni", () => {
    const row = createEmptyRow();
    row.niCm3 = 1e10;
    const layer = rowToLayer(row);
    expect(layer.niM3).toBeDefined();
    const back = layerToRow(layer, row.id);
    expect(back.niCm3).toBe(1e10);
  });
});

describe("types and validation extras", () => {
  it("throws ConvergenceError", () => {
    const err = new ConvergenceError("fail");
    expect(err.name).toBe("ConvergenceError");
  });

  it("integrates doping charge", () => {
    const mesh = buildMesh(uniformNTypeStack(), {
      nodesPerNm: 1,
      minNodesPerLayer: 5,
      tol: 1e-6,
      maxGummelIter: 1,
      maxNewtonIter: 10,
      Vapp: 0,
    });
    expect(Number.isFinite(dopingChargeIntegral(mesh))).toBe(true);
  });
});
