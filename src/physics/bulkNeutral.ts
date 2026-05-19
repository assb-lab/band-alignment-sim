import { KB, Q } from "./constants.ts";
import type { Layer } from "./types.ts";
import { layerDosParams } from "./carriers.ts";

export interface BulkState {
  phiV: number;
  nM3: number;
  pM3: number;
  ecEv: number;
  evEv: number;
}

export function intrinsicLevelEv(
  layer: Layer,
  temperatureK: number,
  ecRefEv: number,
  evRefEv: number,
): number {
  const dos = layerDosParams(layer, temperatureK);
  const kT = (KB * temperatureK) / Q;
  return 0.5 * (ecRefEv + evRefEv) + 0.5 * kT * Math.log(dos.NvM3 / dos.NcM3);
}

function fermiOffsetFromNetDopingEv(netDopingM3: number, niM3: number, temperatureK: number): number {
  if (netDopingM3 === 0) return 0;
  const kT = (KB * temperatureK) / Q;
  const safeNi = Math.max(niM3, Number.MIN_VALUE);
  const ratio = Math.abs(netDopingM3) / (2 * safeNi);
  const offset = Number.isFinite(ratio)
    ? Math.asinh(ratio)
    : Math.log(Math.abs(netDopingM3) / safeNi);
  return Math.sign(netDopingM3) * kT * offset;
}

function neutralCarrierDensities(netDopingM3: number, niM3: number): { nM3: number; pM3: number } {
  const root = Math.hypot(netDopingM3, 2 * niM3);
  return {
    nM3: Math.max(0, 0.5 * (netDopingM3 + root)),
    pM3: Math.max(0, 0.5 * (root - netDopingM3)),
  };
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
  const netDoping = layer.NdM3 - layer.NaM3;
  const intrinsic = intrinsicLevelEv(layer, temperatureK, ecRefEv, evRefEv);
  const offset = fermiOffsetFromNetDopingEv(netDoping, dos.niM3, temperatureK);
  const phi = intrinsic + offset - fermiEv;

  const ec = ecRefEv - phi;
  const ev = evRefEv - phi;
  const { nM3: n, pM3: p } = neutralCarrierDensities(netDoping, dos.niM3);

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
  return intrinsicLevelEv(layer, temperatureK, ecRefEv, ev) +
    fermiOffsetFromNetDopingEv(net, dos.niM3, temperatureK);
}

/** Find Fermi level where bulk electrostatic potential equals targetPhiV */
export function findFermiForBulkPhi(
  layer: Layer,
  temperatureK: number,
  ecRefEv: number,
  evRefEv: number,
  targetPhiV: number,
): number {
  return findBulkFermi(layer, temperatureK, ecRefEv - targetPhiV, evRefEv - targetPhiV);
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
