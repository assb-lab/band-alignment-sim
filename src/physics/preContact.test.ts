import { describe, expect, it } from "vitest";
import { preContactBands, preContactMaterialRegions } from "./preContact.ts";
import { nmToM } from "./units.ts";
import { siSchottkyNStack } from "../presets/materials.ts";

describe("pre-contact profile", () => {
  it("uses metal thickness for display regions", () => {
    const stack = siSchottkyNStack();
    stack.layers[0]!.thicknessM = nmToM(50);

    const regions = preContactMaterialRegions(stack);
    expect(regions[0]!.xEndM - regions[0]!.xStartM).toBeCloseTo(nmToM(50));
  });

  it("keeps a visible fallback width for zero-thickness metal rows", () => {
    const stack = siSchottkyNStack();
    stack.layers[0]!.thicknessM = 0;

    const regions = preContactMaterialRegions(stack);
    expect(regions[0]!.xEndM - regions[0]!.xStartM).toBeCloseTo(nmToM(20));
  });

  it("emits metal Fermi levels without semiconductor band edges", () => {
    const stack = siSchottkyNStack();
    stack.layers[0]!.workFunctionEv = 4.7;

    const profile = preContactBands(stack);
    expect(profile.layerKind[0]).toBe("metal");
    expect(profile.efEv[0]).toBeCloseTo(-4.7);
    expect(Number.isNaN(profile.ecEv[0])).toBe(true);
    expect(Number.isNaN(profile.evEv[0])).toBe(true);
  });
});
