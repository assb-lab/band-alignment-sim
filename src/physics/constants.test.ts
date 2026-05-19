import { describe, expect, it } from "vitest";
import { Q, KB, thermalVoltage } from "./constants.ts";

describe("constants", () => {
  it("provides physical constants", () => {
    expect(Q).toBeGreaterThan(0);
    expect(KB).toBeGreaterThan(0);
  });

  it("computes thermal voltage at 300K", () => {
    expect(thermalVoltage(300)).toBeCloseTo(0.0259, 3);
  });
});
