import { KB, Q } from "./constants.ts";
import { electronDensity, holeDensity } from "./carriers.ts";
import type { BandProfile, Mesh } from "./types.ts";

export function carrierDensities(
  mesh: Mesh,
  phiV: Float64Array,
  eFnEv: Float64Array,
  eFpEv: Float64Array,
  temperatureK: number,
): { nM3: Float64Array; pM3: Float64Array } {
  const n = mesh.nodes.length;
  const nM3 = new Float64Array(n);
  const pM3 = new Float64Array(n);
  const kT = (KB * temperatureK) / Q;

  for (let i = 0; i < n; i++) {
    const node = mesh.nodes[i]!;
    const ec = node.ecRefEv - phiV[i]!;
    const ev = node.evRefEv - phiV[i]!;
    const dos = { niM3: node.niM3, NcM3: node.NcM3, NvM3: node.NvM3 };
    nM3[i] = electronDensity(dos, ec, eFnEv[i]!, kT);
    pM3[i] = holeDensity(dos, ev, eFpEv[i]!, kT);
  }
  return { nM3, pM3 };
}

export function computeBands(
  mesh: Mesh,
  phiV: Float64Array,
  eFnEv: Float64Array,
  eFpEv: Float64Array,
): BandProfile {
  const n = mesh.nodes.length;
  const ecEv = new Float64Array(n);
  const evEv = new Float64Array(n);
  const efnEv = new Float64Array(n);
  const efpEv = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const node = mesh.nodes[i]!;
    ecEv[i] = node.ecRefEv - phiV[i]!;
    evEv[i] = node.evRefEv - phiV[i]!;
    efnEv[i] = eFnEv[i]!;
    efpEv[i] = eFpEv[i]!;
  }
  return { ecEv, evEv, efnEv, efpEv };
}

export function chargeDensity(
  mesh: Mesh,
  nM3: Float64Array,
  pM3: Float64Array,
): Float64Array {
  const rho = new Float64Array(mesh.nodes.length);
  for (let i = 0; i < mesh.nodes.length; i++) {
    const node = mesh.nodes[i]!;
    rho[i] = Q * (pM3[i]! - nM3[i]! + node.NdM3 - node.NaM3);
  }
  return rho;
}

export function electricField(mesh: Mesh, phiV: Float64Array): Float64Array {
  const n = mesh.nodes.length;
  const E = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) {
    E[i] = -(phiV[i + 1]! - phiV[i]!) / mesh.dxM[i]!;
  }
  E[n - 1] = E[n - 2] ?? 0;
  return E;
}
