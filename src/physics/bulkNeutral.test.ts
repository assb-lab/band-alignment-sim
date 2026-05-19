import { describe, expect, it } from "vitest";
import {
  analyticVbi,
  bulkStateAtFermi,
  findFermiForBulkPhi,
  intrinsicLevelEv,
} from "./bulkNeutral.ts";
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

  it("keeps intrinsic wide-gap semiconductor bulk potential continuous", () => {
    const layer = makeLayer({
      label: "LiNbO3",
      thicknessM: 100e-9,
      relativePermittivity: 30,
      bandGapEv: 4.58,
      electronAffinityEv: 1.6,
      NcM3: perCm3ToPerM3(1e19),
      NvM3: perCm3ToPerM3(1e19),
      NdM3: 0,
      NaM3: 0,
    });
    const ecRef = -layer.electronAffinityEv;
    const evRef = ecRef - layer.bandGapEv;
    const intrinsic = intrinsicLevelEv(layer, 300, ecRef, evRef);
    const eFAtZeroPhi = findFermiForBulkPhi(layer, 300, ecRef, evRef, 0);
    expect(eFAtZeroPhi).toBeCloseTo(intrinsic, 8);
    expect(bulkStateAtFermi(layer, 300, eFAtZeroPhi, ecRef, evRef).phiV).toBeCloseTo(0, 8);

    const phiAt2p50 = bulkStateAtFermi(layer, 300, -2.5, ecRef, evRef).phiV;
    const phiAt2p55 = bulkStateAtFermi(layer, 300, -2.55, ecRef, evRef).phiV;
    expect(Math.abs(phiAt2p55 - phiAt2p50)).toBeCloseTo(0.05, 8);
    expect(Math.abs(phiAt2p50)).toBeLessThan(1.5);
  });
});
