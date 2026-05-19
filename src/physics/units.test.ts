import { describe, expect, it } from "vitest";
import { cmToM, eVToJ, jToEv, mToNm, nmToM, perCm3ToPerM3, perM3ToPerCm3 } from "./units.ts";

describe("units", () => {
  it("converts length", () => {
    expect(cmToM(1)).toBeCloseTo(0.01);
    expect(nmToM(100)).toBeCloseTo(1e-7);
    expect(mToNm(1e-7)).toBeCloseTo(100);
  });

  it("converts energy", () => {
    const j = eVToJ(1);
    expect(jToEv(j)).toBeCloseTo(1);
  });

  it("converts density", () => {
    expect(perCm3ToPerM3(1e10)).toBe(1e16);
    expect(perM3ToPerCm3(1e16)).toBe(1e10);
  });
});
