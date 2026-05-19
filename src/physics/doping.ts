import { KB, Q } from "./constants.ts";
import { layerDosParams } from "./carriers.ts";
import { safeExp } from "./statistics.ts";
import type { Layer } from "./types.ts";

export interface VacuumBandEdges {
  ecEv: number;
  evEv: number;
}

export interface NonCompensatedDoping {
  NdM3: number;
  NaM3: number;
  nM3: number;
  pM3: number;
}

export function vacuumBandEdges(layer: Pick<Layer, "electronAffinityEv" | "bandGapEv">): VacuumBandEdges {
  const ecEv = -layer.electronAffinityEv;
  return { ecEv, evEv: ecEv - layer.bandGapEv };
}

export function nonCompensatedDopingFromVacuumFermi(
  layer: Layer,
  temperatureK: number,
  fermiLevelVacuumEv: number,
): NonCompensatedDoping {
  const dos = layerDosParams(layer, temperatureK);
  const kT = (KB * temperatureK) / Q;
  const { ecEv, evEv } = vacuumBandEdges(layer);
  const nM3 = dos.NcM3 * safeExp(-(ecEv - fermiLevelVacuumEv) / kT);
  const pM3 = dos.NvM3 * safeExp(-(fermiLevelVacuumEv - evEv) / kT);
  const net = nM3 - pM3;
  return {
    NdM3: net >= 0 ? net : 0,
    NaM3: net < 0 ? -net : 0,
    nM3,
    pM3,
  };
}

export function vacuumFermiFromNonCompensatedDoping(
  layer: Layer,
  temperatureK: number,
): number {
  const dos = layerDosParams(layer, temperatureK);
  const kT = (KB * temperatureK) / Q;
  const { ecEv, evEv } = vacuumBandEdges(layer);
  const net = layer.NdM3 - layer.NaM3;

  if (net > 0) {
    return ecEv + kT * Math.log(Math.max(net / dos.NcM3, 1e-30));
  }
  if (net < 0) {
    return evEv - kT * Math.log(Math.max(-net / dos.NvM3, 1e-30));
  }
  return 0.5 * (ecEv + evEv) + 0.5 * kT * Math.log(dos.NvM3 / dos.NcM3);
}
