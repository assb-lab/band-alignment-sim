import { KB } from "./constants.ts";
import { eVToJ } from "./units.ts";

/**
 * Intrinsic carrier density from effective DOS and band gap.
 * ni = sqrt(Nc Nv) exp(-Eg / 2kT)
 */
export function intrinsicDensity(
  NcM3: number,
  NvM3: number,
  bandGapEv: number,
  temperatureK: number,
): number {
  const egJ = eVToJ(bandGapEv);
  return Math.sqrt(NcM3 * NvM3) * Math.exp(-egJ / (2 * KB * temperatureK));
}

/** Resolve ni for a layer (direct or from Nc, Nv, Eg) */
export function layerNi(
  layer: {
    niM3?: number;
    NcM3?: number;
    NvM3?: number;
    bandGapEv: number;
  },
  temperatureK: number,
): number {
  if (layer.niM3 !== undefined && layer.niM3 > 0) {
    return layer.niM3;
  }
  if (layer.NcM3 !== undefined && layer.NvM3 !== undefined) {
    return intrinsicDensity(layer.NcM3, layer.NvM3, layer.bandGapEv, temperatureK);
  }
  throw new Error(`Layer must define niM3 or (NcM3, NvM3) for ni calculation`);
}
