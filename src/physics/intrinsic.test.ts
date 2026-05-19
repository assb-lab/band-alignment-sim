import { describe, expect, it } from "vitest";
import { intrinsicDensity, layerNi } from "./intrinsic.ts";
import { perCm3ToPerM3 } from "./units.ts";
import { SI_MATERIAL } from "../presets/materials.ts";

describe("intrinsic", () => {
  it("computes ni from Nc, Nv, Eg", () => {
    const ni = intrinsicDensity(
      SI_MATERIAL.NcM3,
      SI_MATERIAL.NvM3,
      SI_MATERIAL.bandGapEv,
      300,
    );
    expect(ni).toBeGreaterThan(1e14);
    expect(ni).toBeLessThan(1e18);
  });

  it("uses direct ni when provided", () => {
    const ni = layerNi(
      { niM3: perCm3ToPerM3(1e10), bandGapEv: 1.12 },
      300,
    );
    expect(ni).toBe(perCm3ToPerM3(1e10));
  });

  it("throws when ni cannot be resolved", () => {
    expect(() => layerNi({ bandGapEv: 1.12 }, 300)).toThrow(/niM3 or \(NcM3, NvM3\)/);
  });
});
