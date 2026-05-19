import { describe, expect, it } from "vitest";
import { findBulkFermi, findEquilibriumFermi, findFermiForBulkPhi } from "./bulkNeutral.ts";
import { makeLayer } from "../presets/materials.ts";
import { perCm3ToPerM3, nmToM } from "./units.ts";

describe("bulkNeutral extras", () => {
  it("finds bulk Fermi level", () => {
    const layer = makeLayer({
      label: "n",
      thicknessM: nmToM(100),
      NdM3: perCm3ToPerM3(1e16),
      NaM3: 0,
    });
    const eF = findBulkFermi(layer, 300, layer.electronAffinityEv);
    expect(Number.isFinite(eF)).toBe(true);
  });

  it("finds equilibrium Fermi for pn pair", () => {
    const p = makeLayer({
      label: "p",
      thicknessM: nmToM(100),
      NaM3: perCm3ToPerM3(1e16),
      NdM3: 0,
    });
    const n = makeLayer({
      label: "n",
      thicknessM: nmToM(100),
      NdM3: perCm3ToPerM3(1e16),
      NaM3: 0,
    });
    const ec = p.electronAffinityEv;
    const ev = ec - p.bandGapEv;
    const eF = findEquilibriumFermi(p, n, 300, ec, ev, ec, ev);
    expect(Number.isFinite(eF)).toBe(true);
  });

  it("finds Fermi level for target bulk potential", () => {
    const layer = makeLayer({
      label: "n",
      thicknessM: nmToM(100),
      NdM3: perCm3ToPerM3(1e17),
      NaM3: 0,
    });
    const ec = layer.electronAffinityEv;
    const ev = ec - layer.bandGapEv;
    const eF = findFermiForBulkPhi(layer, 300, ec, ev, 0.1);
    expect(Number.isFinite(eF)).toBe(true);
  });
});
