import { describe, expect, it } from "vitest";
import { inferContacts, semiconductorLayers, StackValidationError, validateStack } from "./stackContacts.ts";
import { makeLayer, makeMetalLayer } from "../presets/materials.ts";
import type { LayerStack } from "./types.ts";

function stack(...layers: LayerStack["layers"]): LayerStack {
  return { temperatureK: 300, layers };
}

describe("stackContacts", () => {
  it("returns all semiconductor layers for pn stack", () => {
    const s = stack(
      makeLayer({ label: "p", thicknessM: 1e-6, NaM3: 1e22, NdM3: 0 }),
      makeLayer({ label: "n", thicknessM: 1e-6, NdM3: 1e22, NaM3: 0 }),
    );
    expect(semiconductorLayers(s)).toHaveLength(2);
    expect(inferContacts(s).left).toEqual({ kind: "ohmic" });
    expect(inferContacts(s).right).toEqual({ kind: "ohmic" });
  });

  it("infers Schottky left when metal precedes semiconductor", () => {
    const s = stack(
      makeMetalLayer({ label: "Au", workFunctionEv: 4.8 }),
      makeLayer({ label: "n-Si", thicknessM: 1e-6, NdM3: 1e22, NaM3: 0 }),
    );
    const c = inferContacts(s);
    expect(c.left).toEqual({ kind: "schottky", workFunctionEv: 4.8 });
    expect(c.right).toEqual({ kind: "ohmic" });
    expect(c.firstSemIndex).toBe(1);
  });

  it("infers Schottky right when metal follows semiconductor", () => {
    const s = stack(
      makeLayer({ label: "n-Si", thicknessM: 1e-6, NdM3: 1e22, NaM3: 0 }),
      makeMetalLayer({ label: "Au", workFunctionEv: 5.1 }),
    );
    const c = inferContacts(s);
    expect(c.left).toEqual({ kind: "ohmic" });
    expect(c.right).toEqual({ kind: "schottky", workFunctionEv: 5.1 });
  });

  it("infers both Schottky when metal caps semiconductor", () => {
    const s = stack(
      makeMetalLayer({ workFunctionEv: 4.8 }),
      makeLayer({ label: "n-Si", thicknessM: 1e-6, NdM3: 1e22, NaM3: 0 }),
      makeMetalLayer({ workFunctionEv: 4.5 }),
    );
    const c = inferContacts(s);
    expect(c.left.kind).toBe("schottky");
    expect(c.right.kind).toBe("schottky");
  });

  it("rejects metal between semiconductors", () => {
    const s = stack(
      makeLayer({ label: "p", thicknessM: 1e-6, NaM3: 1e22, NdM3: 0 }),
      makeMetalLayer({ workFunctionEv: 4.8 }),
      makeLayer({ label: "n", thicknessM: 1e-6, NdM3: 1e22, NaM3: 0 }),
    );
    expect(() => validateStack(s)).toThrow(StackValidationError);
    expect(() => inferContacts(s)).toThrow(StackValidationError);
  });

  it("rejects stack with no semiconductor", () => {
    const s = stack(makeMetalLayer({ workFunctionEv: 4.8 }));
    expect(() => validateStack(s)).toThrow(StackValidationError);
  });

  it("rejects metal without work function", () => {
    const s = stack(
      { ...makeMetalLayer({ workFunctionEv: 4.8 }), workFunctionEv: undefined },
      makeLayer({ label: "n", thicknessM: 1e-6, NdM3: 1e22, NaM3: 0 }),
    );
    expect(() => inferContacts(s)).toThrow(StackValidationError);
  });
});
