import { KB, Q } from "./constants.ts";
import { bulkStateAtFermi, findBulkFermi, findFermiForBulkPhi } from "./bulkNeutral.ts";
import { layerDosParams } from "./carriers.ts";
import type { ContactBoundary, ContactKind, Layer } from "./types.ts";

/** Schottky–Mott barrier heights [eV], vacuum reference (Ec = -χ at φ = 0). */
export interface SchottkyBarriers {
  /** Electron barrier: Φ_m − χ */
  phiBnEv: number;
  /** Hole barrier: (χ + E_g) − Φ_m */
  phiBpEv: number;
  /** Dominant carrier at contact */
  isNType: boolean;
}

export function schottkyBarrierHeights(
  layer: Layer,
  workFunctionEv: number,
): SchottkyBarriers {
  const chi = layer.electronAffinityEv;
  const eg = layer.bandGapEv;
  return {
    phiBnEv: workFunctionEv - chi,
    phiBpEv: chi + eg - workFunctionEv,
    isNType: layer.NdM3 >= layer.NaM3,
  };
}

/**
 * Surface electrostatic potential for ideal Schottky contact (Fermi pinned to metal).
 * Enforces E_c − E_F = Φ_m − χ at the surface.
 */
export function schottkySurfacePhi(
  ecRefEv: number,
  layer: Layer,
  metalWorkFunctionEv: number,
): number {
  const chi = layer.electronAffinityEv;
  const metalFermi = metalFermiEv(metalWorkFunctionEv);
  const targetEc = metalFermi + (metalWorkFunctionEv - chi);
  return ecRefEv - targetEc;
}

/** Metal Fermi level [eV] (same vacuum reference as χ). */
export function metalFermiEv(workFunctionEv: number, biasEv = 0): number {
  return -workFunctionEv + biasEv;
}

export function contactWorkFunction(contact: ContactBoundary, layer: Layer): number {
  if (contact.workFunctionEv !== undefined) {
    return contact.workFunctionEv;
  }
  return semiconductorWorkFunction(layer, 300, -layer.electronAffinityEv);
}

export interface ResolvedContact {
  kind: ContactKind;
  workFunctionEv: number;
  fermiEv: number;
  phiV: number;
  barriers?: SchottkyBarriers;
}

function resolveSchottky(
  layer: Layer,
  ecRefEv: number,
  workFunctionEv: number,
  biasEv: number,
): ResolvedContact {
  const fermiEv = metalFermiEv(workFunctionEv, biasEv);
  const barriers = schottkyBarrierHeights(layer, workFunctionEv);
  return {
    kind: "schottky",
    workFunctionEv,
    fermiEv,
    phiV: ecRefEv - (fermiEv + barriers.phiBnEv),
    barriers,
  };
}

/** Ohmic contact: fix majority carrier to doping, Fermi level given (e.g. from metal). */
export function ohmicSurfacePhi(
  layer: Layer,
  ecRefEv: number,
  evRefEv: number,
  temperatureK: number,
  fermiEv: number,
): number {
  const dos = layerDosParams(layer, temperatureK);
  const kT = (KB * temperatureK) / Q;
  const net = layer.NdM3 - layer.NaM3;

  if (net > 0) {
    // n = Nd = Nc exp(-(Ec − E_F)/kT) ⇒ E_c = E_F + kT ln(Nc/Nd)
    const ec = fermiEv + kT * Math.log(dos.NcM3 / layer.NdM3);
    return ecRefEv - ec;
  }
  if (net < 0) {
    // p = Na = Nv exp(-(E_F − Ev)/kT) ⇒ E_v = E_F + kT ln(Na/Nv)
    const ev = fermiEv + kT * Math.log(layer.NaM3 / dos.NvM3);
    return evRefEv - ev;
  }
  return bulkStateAtFermi(layer, temperatureK, fermiEv, ecRefEv, evRefEv).phiV;
}

function resolveOhmic(
  layer: Layer,
  ecRefEv: number,
  evRefEv: number,
  temperatureK: number,
  fermiEv: number,
): ResolvedContact {
  const bulk = bulkStateAtFermi(layer, temperatureK, fermiEv, ecRefEv, evRefEv);
  return {
    kind: "ohmic",
    workFunctionEv: fermiEv,
    fermiEv,
    phiV: bulk.phiV,
  };
}

export interface ContactPair {
  left: ResolvedContact;
  right: ResolvedContact;
}

/** Build left/right contact potentials and Fermi levels. */
export function resolveContacts(
  leftLayer: Layer,
  rightLayer: Layer,
  leftEcRef: number,
  leftEvRef: number,
  rightEcRef: number,
  rightEvRef: number,
  temperatureK: number,
  leftContact: ContactBoundary,
  rightContact: ContactBoundary,
  Vapp: number,
): ContactPair {
  const leftPhiM = contactWorkFunction(leftContact, leftLayer);
  const rightPhiM = contactWorkFunction(rightContact, rightLayer);

  const leftIsSchottky = leftContact.kind === "schottky";
  const rightIsSchottky = rightContact.kind === "schottky";

  if (!leftIsSchottky && !rightIsSchottky) {
    const eFeq = findFermiForBulkPhi(
      rightLayer,
      temperatureK,
      rightEcRef,
      rightEvRef,
      0,
    );
    return {
      left: resolveOhmic(leftLayer, leftEcRef, leftEvRef, temperatureK, eFeq),
      right: resolveOhmic(rightLayer, rightEcRef, rightEvRef, temperatureK, eFeq + Vapp),
    };
  }

  if (leftIsSchottky && rightIsSchottky) {
    return {
      left: resolveSchottky(leftLayer, leftEcRef, leftPhiM, 0),
      right: resolveSchottky(rightLayer, rightEcRef, rightPhiM, Vapp),
    };
  }

  if (leftIsSchottky) {
    const left = resolveSchottky(leftLayer, leftEcRef, leftPhiM, 0);
    const rightFermiEv = left.fermiEv + Vapp;
    const right: ResolvedContact = {
      kind: "ohmic",
      workFunctionEv: rightFermiEv,
      fermiEv: rightFermiEv,
      phiV: ohmicSurfacePhi(
        rightLayer,
        rightEcRef,
        rightEvRef,
        temperatureK,
        rightFermiEv,
      ),
    };
    return { left, right };
  }

  const right = resolveSchottky(rightLayer, rightEcRef, rightPhiM, Vapp);
  const left = resolveOhmic(leftLayer, leftEcRef, leftEvRef, temperatureK, right.fermiEv);
  return { left, right };
}

/** Semiconductor work function Φ_s = χ + (E_c − E_F) in bulk. */
export function semiconductorWorkFunction(
  layer: Layer,
  temperatureK: number,
  ecRefEv: number,
): number {
  const eF = findBulkFermi(layer, temperatureK, ecRefEv);
  const bulk = bulkStateAtFermi(layer, temperatureK, eF, ecRefEv, ecRefEv - layer.bandGapEv);
  return layer.electronAffinityEv + (bulk.ecEv - eF);
}
