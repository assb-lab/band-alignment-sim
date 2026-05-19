import type { Layer, LayerKind } from "../physics/types.ts";
import { perCm3ToPerM3, perM3ToPerCm3, nmToM, mToNm } from "../physics/units.ts";
import { makeMetalLayer } from "../presets/materials.ts";
import {
  nonCompensatedDopingFromVacuumFermi,
  vacuumFermiFromNonCompensatedDoping,
} from "../physics/doping.ts";

/** UI-facing layer row (display units) */
export type DopingInputMode = "fermi" | "direct";

export interface LayerRow {
  id: string;
  kind: LayerKind;
  label: string;
  dopingInputMode: DopingInputMode;
  thicknessNm: number;
  /** Metal work function Φ_m [eV] */
  workFunctionEv: number;
  epsilonR: number;
  bandGapEv: number;
  electronAffinityEv: number;
  NcCm3: number;
  NvCm3: number;
  niCm3: number | null;
  fermiLevelVacuumEv: number;
  NdCm3: number;
  NaCm3: number;
  deltaEcEv: number;
  deltaEvEv: number;
}

export function layerToRow(layer: Layer, id: string, temperatureK = 300): LayerRow {
  const kind = layer.kind ?? "semiconductor";
  const baseLayer = {
    ...layer,
    kind,
  };
  const fermiLevelVacuumEv =
    layer.fermiLevelVacuumEv ??
    (kind === "metal"
      ? -(layer.workFunctionEv ?? 4.8)
      : vacuumFermiFromNonCompensatedDoping(baseLayer, temperatureK));
  return {
    id,
    kind,
    label: layer.label,
    dopingInputMode: "fermi",
    thicknessNm: mToNm(layer.thicknessM),
    workFunctionEv: layer.workFunctionEv ?? 4.8,
    epsilonR: layer.epsilonR,
    bandGapEv: layer.bandGapEv,
    electronAffinityEv: layer.electronAffinityEv,
    NcCm3: layer.NcM3 ? perM3ToPerCm3(layer.NcM3) : 0,
    NvCm3: layer.NvM3 ? perM3ToPerCm3(layer.NvM3) : 0,
    niCm3: layer.niM3 ? perM3ToPerCm3(layer.niM3) : null,
    fermiLevelVacuumEv,
    NdCm3: perM3ToPerCm3(layer.NdM3),
    NaCm3: perM3ToPerCm3(layer.NaM3),
    deltaEcEv: layer.deltaEcEv,
    deltaEvEv: layer.deltaEvEv,
  };
}

export function withDopingFromFermi(row: LayerRow, temperatureK = 300): LayerRow {
  if (row.kind === "metal" || !Number.isFinite(row.fermiLevelVacuumEv)) {
    return row;
  }
  const layer = rowToSemiconductorLayer(row, row.NdCm3, row.NaCm3);
  const doping = nonCompensatedDopingFromVacuumFermi(
    layer,
    temperatureK,
    row.fermiLevelVacuumEv,
  );
  return {
    ...row,
    NdCm3: perM3ToPerCm3(doping.NdM3),
    NaCm3: perM3ToPerCm3(doping.NaM3),
  };
}

export function withFermiFromDoping(row: LayerRow, temperatureK = 300): LayerRow {
  if (row.kind === "metal") {
    return { ...row, fermiLevelVacuumEv: -row.workFunctionEv };
  }
  const layer = rowToSemiconductorLayer(row, row.NdCm3, row.NaCm3);
  return {
    ...row,
    fermiLevelVacuumEv: vacuumFermiFromNonCompensatedDoping(layer, temperatureK),
  };
}

function rowToSemiconductorLayer(row: LayerRow, NdCm3: number, NaCm3: number): Layer {
  return {
    kind: "semiconductor",
    label: row.label,
    thicknessM: nmToM(row.thicknessNm),
    epsilonR: row.epsilonR,
    bandGapEv: row.bandGapEv,
    electronAffinityEv: row.electronAffinityEv,
    NcM3: row.niCm3 ? undefined : perCm3ToPerM3(row.NcCm3),
    NvM3: row.niCm3 ? undefined : perCm3ToPerM3(row.NvCm3),
    niM3: row.niCm3 ? perCm3ToPerM3(row.niCm3) : undefined,
    NdM3: perCm3ToPerM3(NdCm3),
    NaM3: perCm3ToPerM3(NaCm3),
    deltaEcEv: row.deltaEcEv,
    deltaEvEv: row.deltaEvEv,
    fermiLevelVacuumEv: row.fermiLevelVacuumEv,
  };
}

export function rowToLayer(
  row: LayerRow,
  temperatureK = 300,
  dopingInputMode: DopingInputMode = row.dopingInputMode ?? "fermi",
): Layer {
  if (row.kind === "metal") {
    return makeMetalLayer({
      label: row.label,
      thicknessM: nmToM(row.thicknessNm),
      workFunctionEv: row.workFunctionEv,
      fermiLevelVacuumEv: row.fermiLevelVacuumEv,
    });
  }
  const doped =
    dopingInputMode === "fermi" ? withDopingFromFermi(row, temperatureK) : row;
  return rowToSemiconductorLayer(doped, doped.NdCm3, doped.NaCm3);
}

export function createSemiconductorRow(label = "Layer"): LayerRow {
  const row: LayerRow = {
    id: crypto.randomUUID(),
    kind: "semiconductor",
    label,
    dopingInputMode: "fermi",
    thicknessNm: 100,
    workFunctionEv: 4.8,
    epsilonR: 11.7,
    bandGapEv: 1.12,
    electronAffinityEv: 4.05,
    NcCm3: 2.8e19,
    NvCm3: 1.04e19,
    niCm3: null,
    fermiLevelVacuumEv: -4.61,
    NdCm3: 0,
    NaCm3: 0,
    deltaEcEv: 0,
    deltaEvEv: 0,
  };
  return withDopingFromFermi(row);
}

export function createMetalRow(label = "Metal", workFunctionEv = 4.8): LayerRow {
  return {
    id: crypto.randomUUID(),
    kind: "metal",
    label,
    dopingInputMode: "fermi",
    thicknessNm: 0,
    workFunctionEv,
    epsilonR: 1,
    bandGapEv: 0,
    electronAffinityEv: 0,
    NcCm3: 0,
    NvCm3: 0,
    niCm3: null,
    fermiLevelVacuumEv: -workFunctionEv,
    NdCm3: 0,
    NaCm3: 0,
    deltaEcEv: 0,
    deltaEvEv: 0,
  };
}

/** @deprecated Use createSemiconductorRow */
export function createEmptyRow(label = "Layer"): LayerRow {
  return createSemiconductorRow(label);
}
