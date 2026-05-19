import type { Layer } from "./types.ts";
import { layerNi } from "./intrinsic.ts";
import { boltzmannCarrier } from "./statistics.ts";

export interface DosParams {
  niM3: number;
  NcM3: number;
  NvM3: number;
}

export function layerDosParams(layer: Layer, temperatureK: number): DosParams {
  const niM3 = layerNi(layer, temperatureK);
  return {
    niM3,
    NcM3: layer.NcM3 ?? niM3,
    NvM3: layer.NvM3 ?? niM3,
  };
}

/** n = Nc exp(-(Ec − E_F)/kT) */
export function electronDensity(
  dos: DosParams,
  ecEv: number,
  eFEv: number,
  kTEv: number,
): number {
  if (dos.NcM3 > dos.niM3) {
    return boltzmannCarrier(dos.NcM3, eFEv - ecEv, kTEv);
  }
  return boltzmannCarrier(dos.niM3, eFEv - ecEv, kTEv);
}

/** p = Nv exp(-(E_F − Ev)/kT) */
export function holeDensity(
  dos: DosParams,
  evEv: number,
  eFEv: number,
  kTEv: number,
): number {
  if (dos.NvM3 > dos.niM3) {
    return boltzmannCarrier(dos.NvM3, evEv - eFEv, kTEv);
  }
  return boltzmannCarrier(dos.niM3, evEv - eFEv, kTEv);
}
