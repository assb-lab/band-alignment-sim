import { Q } from "./constants.ts";
import type { Mesh } from "./types.ts";

/** Integrated net charge per unit area [C/m^2] */
export function integratedCharge(
  mesh: Mesh,
  rhoCm3: Float64Array,
): number {
  let integral = 0;
  for (let i = 0; i < mesh.nodes.length - 1; i++) {
    const dx = mesh.dxM[i]!;
    integral += 0.5 * (rhoCm3[i]! + rhoCm3[i + 1]!) * dx;
  }
  return integral;
}

/** Relative change between two arrays */
export function relativeChange(a: Float64Array, b: Float64Array): number {
  let maxRel = 0;
  for (let i = 0; i < a.length; i++) {
    const denom = Math.max(Math.abs(a[i]!), 1);
    maxRel = Math.max(maxRel, Math.abs(a[i]! - b[i]!) / denom);
  }
  return maxRel;
}

export function isFiniteArray(a: Float64Array): boolean {
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]!)) return false;
  }
  return true;
}

export function dopingChargeIntegral(mesh: Mesh): number {
  let sum = 0;
  for (let i = 0; i < mesh.nodes.length - 1; i++) {
    const node = mesh.nodes[i]!;
    const dx = mesh.dxM[i]!;
    sum += Q * (node.NdM3 - node.NaM3) * dx;
  }
  return sum;
}
