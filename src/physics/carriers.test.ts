import { describe, expect, it } from "vitest";
import { makeLayer } from "../presets/materials.ts";
import { perCm3ToPerM3 } from "./units.ts";
import { findFermiForBulkPhi } from "./bulkNeutral.ts";
import { solveStack } from "./gummel.ts";

describe("carriers (Boltzmann in Poisson)", () => {
  it("places p-type Fermi level in the band gap above Ev", () => {
    const layer = makeLayer({
      label: "p-Si",
      thicknessM: 1e-6,
      NaM3: perCm3ToPerM3(1e16),
      NdM3: 0,
    });
    const stack = { temperatureK: 300, layers: [layer] };
    const ecRef = layer.electronAffinityEv;
    const evRef = ecRef - layer.bandGapEv;
    const eF = findFermiForBulkPhi(layer, 300, ecRef, evRef, 0);
    const bulkEv = evRef;
    expect(eF).toBeGreaterThan(bulkEv);
    expect(eF).toBeLessThan(ecRef);

    const result = solveStack(stack, {
      nodesPerNm: 2,
      minNodesPerLayer: 40,
      tol: 1e-4,
      maxGummelIter: 80,
      maxNewtonIter: 800,
      Vapp: 0,
    });
    const i = 0;
    expect(result.bands.efpEv[i]).toBeGreaterThan(result.bands.evEv[i]);
    expect(result.bands.efpEv[i]).toBeLessThan(result.bands.ecEv[i]);
  });
});
