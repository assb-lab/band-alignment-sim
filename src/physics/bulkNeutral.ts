import { KB, Q } from "./constants.ts";
import type { Layer } from "./types.ts";
import { layerDosParams } from "./carriers.ts";
import { boltzmannElectronDensity, boltzmannHoleDensity } from "./statistics.ts";

export interface BulkState {
  phiV: number;
  nM3: number;
  pM3: number;
  ecEv: number;
  evEv: number;
}

/**
 * Solve charge neutrality in bulk for given Fermi level (eV, vacuum ref).
 * Ec_ref, Ev_ref at phi=0 reference.
 */
export function bulkStateAtFermi(
  layer: Layer,
  temperatureK: number,
  fermiEv: number,
  ecRefEv: number,
  evRefEv: number,
): BulkState {
  const dos = layerDosParams(layer, temperatureK);
  const kT = (KB * temperatureK) / Q;
  const netDoping = layer.NdM3 - layer.NaM3;

  const solvePhi = (phi: number): number => {
    const ec = ecRefEv - phi;
    const ev = evRefEv - phi;
    const n = boltzmannElectronDensity(dos.NcM3, ec, fermiEv, kT);
    const p = boltzmannHoleDensity(dos.NvM3, ev, fermiEv, kT);
    return n - p - netDoping;
  };

  let phiLo = -2;
  let phiHi = 2;
  let fLo = solvePhi(phiLo);
  let fHi = solvePhi(phiHi);
  let expand = 0;
  while (fLo * fHi > 0 && expand < 20) {
    phiLo -= 1;
    phiHi += 1;
    fLo = solvePhi(phiLo);
    fHi = solvePhi(phiHi);
    expand++;
  }

  let phi = 0;
  for (let i = 0; i < 80; i++) {
    phi = 0.5 * (phiLo + phiHi);
    const f = solvePhi(phi);
    if (Math.abs(f) < 1e-20 * Math.max(1, Math.abs(netDoping))) break;
    if (f * fLo < 0) phiHi = phi;
    else phiLo = phi;
  }

  const ec = ecRefEv - phi;
  const ev = evRefEv - phi;
  const n = boltzmannElectronDensity(dos.NcM3, ec, fermiEv, kT);
  const p = boltzmannHoleDensity(dos.NvM3, ev, fermiEv, kT);

  return { phiV: phi, nM3: n, pM3: p, ecEv: ec, evEv: ev };
}

/** Find Fermi level for a single bulk region at phi reference */
export function findBulkFermi(
  layer: Layer,
  temperatureK: number,
  ecRefEv: number,
  evRefEv?: number,
): number {
  const ev = evRefEv ?? ecRefEv - layer.bandGapEv;
  const dos = layerDosParams(layer, temperatureK);
  const net = layer.NdM3 - layer.NaM3;
  const kT = (KB * temperatureK) / Q;

  if (net > 0 && dos.NcM3 > dos.niM3) {
    return ecRefEv - kT * Math.log(dos.NcM3 / layer.NdM3);
  }
  if (net < 0 && dos.NvM3 > dos.niM3) {
    return ev + kT * Math.log(dos.NvM3 / layer.NaM3);
  }

  const ni = dos.niM3;
  const discriminant = net * net + 4 * ni * ni;
  const n = 0.5 * (net + Math.sqrt(discriminant));
  return ecRefEv + kT * Math.log(Math.max(n / ni, 1e-30));
}

/** Find Fermi level where bulk electrostatic potential equals targetPhiV */
export function findFermiForBulkPhi(
  layer: Layer,
  temperatureK: number,
  ecRefEv: number,
  evRefEv: number,
  targetPhiV: number,
): number {
  let eFLo = evRefEv - 2;
  let eFHi = ecRefEv + 2;

  for (let i = 0; i < 100; i++) {
    const eFMid = 0.5 * (eFLo + eFHi);
    const phi = bulkStateAtFermi(layer, temperatureK, eFMid, ecRefEv, evRefEv).phiV;
    if (Math.abs(phi - targetPhiV) < 1e-10) return eFMid;
    if (phi > targetPhiV) eFLo = eFMid;
    else eFHi = eFMid;
  }
  return 0.5 * (eFLo + eFHi);
}

/** @deprecated Use findFermiForBulkPhi with right-contact reference instead */
export function findEquilibriumFermi(
  leftLayer: Layer,
  rightLayer: Layer,
  temperatureK: number,
  leftEcRef: number,
  leftEvRef: number,
  rightEcRef: number,
  rightEvRef: number,
): number {
  const kT = (KB * temperatureK) / Q;
  const midEg =
    0.5 *
    (leftEcRef - leftEvRef + (rightEcRef - rightEvRef));

  let eFLo = Math.min(leftEcRef, rightEcRef) - 2 * midEg;
  let eFHi = Math.max(leftEcRef, rightEcRef);

  const mismatch = (eF: number): number => {
    const left = bulkStateAtFermi(leftLayer, temperatureK, eF, leftEcRef, leftEvRef);
    const right = bulkStateAtFermi(rightLayer, temperatureK, eF, rightEcRef, rightEvRef);
    return left.phiV - right.phiV;
  };

  let fLo = mismatch(eFLo);
  let fHi = mismatch(eFHi);
  let expand = 0;
  while (fLo * fHi > 0 && expand < 30) {
    eFLo -= kT;
    eFHi += kT;
    fLo = mismatch(eFLo);
    fHi = mismatch(eFHi);
    expand++;
  }

  for (let i = 0; i < 100; i++) {
    const eFMid = 0.5 * (eFLo + eFHi);
    const fMid = mismatch(eFMid);
    if (Math.abs(fMid) < 1e-12) return eFMid;
    if (fMid * fLo < 0) {
      eFHi = eFMid;
    } else {
      eFLo = eFMid;
      fLo = fMid;
    }
  }
  return 0.5 * (eFLo + eFHi);
}

/** Built-in voltage Vbi = phi_p - phi_n (left minus right contact bulk) */
export function builtInVoltage(
  leftPhi: number,
  rightPhi: number,
): number {
  return leftPhi - rightPhi;
}

/** Analytic Vbi for abrupt homojunction pn */
export function analyticVbi(
  NdM3: number,
  NaM3: number,
  niM3: number,
  temperatureK: number,
): number {
  const kT = (KB * temperatureK) / Q;
  return kT * Math.log((NaM3 * NdM3) / (niM3 * niM3));
}
