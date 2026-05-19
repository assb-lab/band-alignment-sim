import { describe, expect, it } from "vitest";
import { bulkStateAtFermi, analyticVbi } from "./bulkNeutral.ts";
import { perCm3ToPerM3 } from "./units.ts";
import { makeLayer, SI_MATERIAL } from "../presets/materials.ts";
import { layerNi } from "./intrinsic.ts";

describe("bulkNeutral", () => {
  it("satisfies charge neutrality in n-type bulk", () => {
    const layer = makeLayer({
      label: "n",
      thicknessM: 1e-6,
      NdM3: perCm3ToPerM3(1e16),
      NaM3: 0,
    });
    const ecRef = layer.electronAffinityEv;
    const evRef = ecRef - layer.bandGapEv;
    const eF = ecRef - 0.2;
    const bulk = bulkStateAtFermi(layer, 300, eF, ecRef, evRef);
    expect(Math.abs(bulk.nM3 - bulk.pM3 - layer.NdM3) / layer.NdM3).toBeLessThan(1e-6);
  });

  it("satisfies charge neutrality in p-type bulk", () => {
    const layer = makeLayer({
      label: "p",
      thicknessM: 1e-6,
      NaM3: perCm3ToPerM3(1e16),
      NdM3: 0,
    });
    const ecRef = layer.electronAffinityEv;
    const evRef = ecRef - layer.bandGapEv;
    const eF = evRef + 0.2;
    const bulk = bulkStateAtFermi(layer, 300, eF, ecRef, evRef);
    expect(Math.abs(bulk.nM3 - bulk.pM3 + layer.NaM3) / layer.NaM3).toBeLessThan(1e-6);
  });

  it("matches analytic Vbi formula", () => {
    const Nd = perCm3ToPerM3(1e16);
    const Na = perCm3ToPerM3(1e16);
    const ni = layerNi(SI_MATERIAL, 300);
    const vbi = analyticVbi(Nd, Na, ni, 300);
    expect(vbi).toBeGreaterThan(0.6);
    expect(vbi).toBeLessThan(0.9);
  });
});
