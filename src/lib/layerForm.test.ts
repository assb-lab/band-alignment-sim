import { describe, expect, it } from "vitest";
import { layerToRow, rowToLayer } from "../lib/layerForm.ts";
import { makeLayer, makeMetalLayer } from "../presets/materials.ts";
import { perCm3ToPerM3, nmToM } from "../physics/units.ts";

function expectRelativeClose(actual: number, expected: number, relTol = 1e-9) {
  expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1)).toBeLessThan(relTol);
}

describe("layerForm", () => {
  it("round-trips layer fields", () => {
    const layer = makeLayer({
      label: "test",
      thicknessM: nmToM(100),
      NdM3: perCm3ToPerM3(1e16),
      NaM3: 0,
    });
    const row = layerToRow(layer, "a");
    const back = rowToLayer(row);
    expect(back.thicknessM).toBeCloseTo(layer.thicknessM);
    expectRelativeClose(back.NdM3, layer.NdM3);
    expect(back.NaM3).toBeCloseTo(layer.NaM3);
  });

  it("keeps both donor and acceptor densities in direct doping mode", () => {
    const layer = makeLayer({
      label: "compensated",
      thicknessM: nmToM(100),
      NdM3: perCm3ToPerM3(2e16),
      NaM3: perCm3ToPerM3(1e16),
    });
    const row = layerToRow(layer, "c");
    const back = rowToLayer(row, 300, "direct");
    expectRelativeClose(back.NdM3, layer.NdM3);
    expectRelativeClose(back.NaM3, layer.NaM3);
  });

  it("round-trips metal layer", () => {
    const layer = makeMetalLayer({ label: "Au", workFunctionEv: 4.8 });
    const row = layerToRow(layer, "m");
    expect(row.kind).toBe("metal");
    const back = rowToLayer(row);
    expect(back.kind).toBe("metal");
    expect(back.workFunctionEv).toBe(4.8);
  });
});
