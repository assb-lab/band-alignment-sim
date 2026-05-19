import { vacuumBandEdges, vacuumFermiFromNonCompensatedDoping } from "./doping.ts";
import type { LayerStack, MaterialRegion, PreContactBandProfile } from "./types.ts";

const ZERO_THICKNESS_METAL_VISIBLE_M = 20e-9;

export function preContactMaterialRegions(stack: LayerStack): MaterialRegion[] {
  const regions: MaterialRegion[] = [];
  let x = 0;
  stack.layers.forEach((layer, layerIndex) => {
    const visibleThicknessM =
      layer.kind === "metal" && layer.thicknessM <= 0
        ? ZERO_THICKNESS_METAL_VISIBLE_M
        : layer.thicknessM;
    const xStartM = x;
    const xEndM = xStartM + visibleThicknessM;
    regions.push({ label: layer.label, layerIndex, xStartM, xEndM });
    x = xEndM;
  });
  return regions;
}

export function preContactBands(stack: LayerStack): PreContactBandProfile {
  const regions = preContactMaterialRegions(stack);
  const xM: number[] = [];
  const ec: number[] = [];
  const ev: number[] = [];
  const ef: number[] = [];
  const layerKind: PreContactBandProfile["layerKind"] = [];

  for (const region of regions) {
    const layer = stack.layers[region.layerIndex]!;
    const fermiEv =
      layer.kind === "metal"
        ? -(layer.workFunctionEv ?? 4.8)
        : layer.fermiLevelVacuumEv ??
          vacuumFermiFromNonCompensatedDoping(layer, stack.temperatureK);
    const edges = layer.kind === "metal" ? null : vacuumBandEdges(layer);
    for (const x of [region.xStartM, region.xEndM]) {
      xM.push(x);
      ec.push(edges?.ecEv ?? Number.NaN);
      ev.push(edges?.evEv ?? Number.NaN);
      ef.push(fermiEv);
      layerKind.push(layer.kind);
    }
  }

  return {
    xM: Float64Array.from(xM),
    layerKind,
    ecEv: Float64Array.from(ec),
    evEv: Float64Array.from(ev),
    efEv: Float64Array.from(ef),
  };
}
