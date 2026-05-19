import { describe, expect, it } from "vitest";
import { nonCompensatedDopingFromVacuumFermi, vacuumBandEdges } from "./doping.ts";
import { perCm3ToPerM3 } from "./units.ts";
import { makeLayer, SI_MATERIAL } from "../presets/materials.ts";

const siLayer = makeLayer({
  label: "Si",
  thicknessM: 1e-6,
  ...SI_MATERIAL,
  NdM3: 0,
  NaM3: 0,
});

describe("vacuum-referenced doping helpers", () => {
  it("uses physical vacuum band edges", () => {
    const edges = vacuumBandEdges(siLayer);
    expect(edges.ecEv).toBeCloseTo(-4.05);
    expect(edges.evEv).toBeCloseTo(-5.17);
  });

  it("maps EF near Ec to donor doping", () => {
    const edges = vacuumBandEdges(siLayer);
    const doping = nonCompensatedDopingFromVacuumFermi(siLayer, 300, edges.ecEv - 0.2);
    expect(doping.NdM3).toBeGreaterThan(perCm3ToPerM3(1e15));
    expect(doping.NaM3).toBe(0);
  });

  it("maps EF near Ev to acceptor doping", () => {
    const edges = vacuumBandEdges(siLayer);
    const doping = nonCompensatedDopingFromVacuumFermi(siLayer, 300, edges.evEv + 0.2);
    expect(doping.NaM3).toBeGreaterThan(perCm3ToPerM3(1e15));
    expect(doping.NdM3).toBe(0);
  });
});
