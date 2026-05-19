import { describe, expect, it } from "vitest";
import { bernoulli, solveTridiagonal } from "./tridiagonal.ts";

describe("tridiagonal", () => {
  it("solves a simple system", () => {
    const a = new Float64Array([0, 1, 1]);
    const b = new Float64Array([2, 2, 2]);
    const c = new Float64Array([1, 1, 0]);
    const d = new Float64Array([1, 2, 3]);
    const x = solveTridiagonal(a, b, c, d);
    expect(x.length).toBe(3);
    expect(Number.isFinite(x[0]!)).toBe(true);
  });

  it("evaluates Bernoulli function near zero", () => {
    expect(bernoulli(0)).toBeCloseTo(1, 5);
    expect(bernoulli(1e-6)).toBeCloseTo(1, 5);
  });
});
