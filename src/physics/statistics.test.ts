import { describe, expect, it } from "vitest";
import { safeExp, boltzmannCarrier } from "./statistics.ts";

describe("statistics", () => {
  it("clamps exponential overflow", () => {
    expect(safeExp(100)).toBeLessThan(Infinity);
    expect(safeExp(-100)).toBeGreaterThan(0);
  });

  it("computes carrier density", () => {
    const n = boltzmannCarrier(1e16, 0, 0.026);
    expect(n).toBeCloseTo(1e16, -10);
  });
});
