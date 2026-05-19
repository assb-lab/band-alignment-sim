import { EPS0, KB, Q } from "./constants.ts";
import { electronDensity, holeDensity } from "./carriers.ts";
import type { Mesh } from "./types.ts";
import { solveTridiagonal } from "./tridiagonal.ts";
import { relativeChange } from "./validation.ts";

function epsAt(mesh: Mesh, i: number): number {
  const left = mesh.nodes[i]!;
  const right = mesh.nodes[i + 1]!;
  return EPS0 * 0.5 * (left.epsilonR + right.epsilonR);
}

export interface PoissonContext {
  mesh: Mesh;
  temperatureK: number;
  eFnEv: Float64Array;
  eFpEv: Float64Array;
  useBoltzmann: boolean;
  nM3?: Float64Array;
  pM3?: Float64Array;
}

function carriersAtNode(ctx: PoissonContext, i: number, phi: number): { n: number; p: number } {
  const node = ctx.mesh.nodes[i]!;
  const kT = (KB * ctx.temperatureK) / Q;
  const ec = node.ecRefEv - phi;
  const ev = node.evRefEv - phi;

  if (ctx.useBoltzmann) {
    const dos = { niM3: node.niM3, NcM3: node.NcM3, NvM3: node.NvM3 };
    const n = electronDensity(dos, ec, ctx.eFnEv[i]!, kT);
    const p = holeDensity(dos, ev, ctx.eFpEv[i]!, kT);
    return { n, p };
  }
  return { n: ctx.nM3![i]!, p: ctx.pM3![i]! };
}

function rhoAt(ctx: PoissonContext, i: number, phi: number): number {
  const node = ctx.mesh.nodes[i]!;
  const { n, p } = carriersAtNode(ctx, i, phi);
  return Q * (p - n + node.NdM3 - node.NaM3);
}

/** Discrete Poisson residual (same stencil as the tridiagonal solve). */
function poissonResidualAt(ctx: PoissonContext, phi: Float64Array, i: number): number {
  const mesh = ctx.mesh;
  const dxL = mesh.dxM[i - 1]!;
  const dxR = mesh.dxM[i]!;
  const h = 0.5 * (dxL + dxR);
  const cL = epsAt(mesh, i - 1) / (dxL * h);
  const cR = epsAt(mesh, i) / (dxR * h);
  const rho = rhoAt(ctx, i, phi[i]!);
  return -cL * phi[i - 1]! + (cL + cR) * phi[i]! - cR * phi[i + 1]! - rho;
}

/** Typical volume charge scale [C/m³] for residual normalization */
export function poissonChargeScale(ctx: PoissonContext, phiV?: Float64Array): number {
  let scale = 0;
  for (let i = 0; i < ctx.mesh.nodes.length; i++) {
    const node = ctx.mesh.nodes[i]!;
    scale = Math.max(
      scale,
      Math.abs(Q * (node.NdM3 - node.NaM3)),
      Q * node.niM3,
    );
    if (phiV) {
      const { n, p } = carriersAtNode(ctx, i, phiV[i]!);
      scale = Math.max(scale, Q * n, Q * p);
    }
  }
  return Math.max(scale, Q * 1e12);
}

/** Picard iteration with optional under-relaxation */
export function solvePoissonPicard(
  ctx: PoissonContext,
  phiV: Float64Array,
  phiLeft: number,
  phiRight: number,
  maxIter: number,
  tol: number,
  relax = 1,
): Float64Array {
  const mesh = ctx.mesh;
  const n = mesh.nodes.length;
  const phi = new Float64Array(phiV);
  phi[0] = phiLeft;
  phi[n - 1] = phiRight;

  for (let iter = 0; iter < maxIter; iter++) {
    const m = n - 2;
    if (m <= 0) return phi;

    const phiPrev = new Float64Array(phi);
    phiPrev[0] = phiLeft;
    phiPrev[n - 1] = phiRight;

    const lower = new Float64Array(m);
    const diag = new Float64Array(m);
    const upper = new Float64Array(m);
    const rhs = new Float64Array(m);

    for (let j = 0; j < m; j++) {
      const i = j + 1;
      const dxL = mesh.dxM[i - 1]!;
      const dxR = mesh.dxM[i]!;
      const h = 0.5 * (dxL + dxR);
      const cL = epsAt(mesh, i - 1) / (dxL * h);
      const cR = epsAt(mesh, i) / (dxR * h);
      const rho = rhoAt(ctx, i, phiPrev[i]!);

      lower[j] = -cL;
      diag[j] = cL + cR;
      upper[j] = -cR;
      rhs[j] = rho;
      if (j === 0) rhs[j] += cL * phiLeft;
      if (j === m - 1) rhs[j] += cR * phiRight;
    }

    const interior = solveTridiagonal(lower, diag, upper, rhs);
    for (let j = 0; j < m; j++) {
      const next = interior[j]!;
      phi[j + 1] = relax * next + (1 - relax) * phiPrev[j + 1]!;
    }
    phi[0] = phiLeft;
    phi[n - 1] = phiRight;

    if (relativeChange(phiPrev, phi) < tol) break;
  }

  return phi;
}

/**
 * Stabilized nonlinear Poisson iteration.
 * The residual is the original finite-difference Poisson equation; the
 * Boltzmann carrier term uses a positive M-matrix diagonal for monotone damping.
 */
export function solvePoissonNewton(
  ctx: PoissonContext,
  phiV: Float64Array,
  phiLeft: number,
  phiRight: number,
  maxIter: number,
  tol: number,
): Float64Array {
  const mesh = ctx.mesh;
  const n = mesh.nodes.length;
  const phi = new Float64Array(phiV);
  phi[0] = phiLeft;
  phi[n - 1] = phiRight;
  const kT = (KB * ctx.temperatureK) / Q;

  for (let iter = 0; iter < maxIter; iter++) {
    const m = n - 2;
    if (m <= 0) return phi;

    const lower = new Float64Array(m);
    const diag = new Float64Array(m);
    const upper = new Float64Array(m);
    const rhs = new Float64Array(m);

    let maxRes = 0;

    for (let j = 0; j < m; j++) {
      const i = j + 1;
      const dxL = mesh.dxM[i - 1]!;
      const dxR = mesh.dxM[i]!;
      const h = 0.5 * (dxL + dxR);
      const res = poissonResidualAt(ctx, phi, i);
      maxRes = Math.max(maxRes, Math.abs(res));

      const { n: nDens, p: pDens } = carriersAtNode(ctx, i, phi[i]!);
      const carrierSlopeDamping = ctx.useBoltzmann ? (Q / kT) * (nDens + pDens) : 0;
      const cL = epsAt(mesh, i - 1) / (dxL * h);
      const cR = epsAt(mesh, i) / (dxR * h);

      lower[j] = -cL;
      diag[j] = cL + cR + carrierSlopeDamping;
      upper[j] = -cR;
      rhs[j] = -res;
    }

    if (maxRes < tol) break;

    const delta = solveTridiagonal(lower, diag, upper, rhs);
    let maxDelta = 0;
    for (const d of delta) maxDelta = Math.max(maxDelta, Math.abs(d));

    let stepScale = 1;
    if (maxDelta > 0.5) {
      stepScale = 0.5 / maxDelta;
    }
    const trial = new Float64Array(phi);
    const baseRes = poissonResidualNorm(ctx, phi);
    let accepted = false;
    for (let ls = 0; ls < 32; ls++) {
      trial[0] = phiLeft;
      trial[n - 1] = phiRight;
      for (let j = 0; j < m; j++) {
        trial[j + 1] = phi[j + 1]! + stepScale * delta[j]!;
      }
      const trialRes = poissonResidualNorm(ctx, trial);
      if (trialRes < baseRes) {
        for (let j = 0; j < m; j++) {
          phi[j + 1] = trial[j + 1]!;
        }
        accepted = true;
        break;
      }
      stepScale *= 0.5;
    }
    if (!accepted) break;
  }

  phi[0] = phiLeft;
  phi[n - 1] = phiRight;
  return phi;
}

export function solvePoisson(
  ctx: PoissonContext,
  phiV: Float64Array,
  phiLeft: number,
  phiRight: number,
  maxIter: number,
  tol: number,
): Float64Array {
  if (ctx.useBoltzmann) {
    return solvePoissonNewton(ctx, phiV, phiLeft, phiRight, maxIter, tol);
  }
  return solvePoissonPicard(ctx, phiV, phiLeft, phiRight, maxIter, tol);
}

export function poissonResidualNorm(ctx: PoissonContext, phiV: Float64Array): number {
  let maxRes = 0;
  for (let i = 1; i < ctx.mesh.nodes.length - 1; i++) {
    maxRes = Math.max(maxRes, Math.abs(poissonResidualAt(ctx, phiV, i)));
  }
  return maxRes;
}
