import { perCm3ToPerM3, nmToM } from "../physics/units.ts";
import type { Layer, LayerStack } from "../physics/types.ts";

export const SI_MATERIAL = {
  epsilonR: 11.7,
  bandGapEv: 1.12,
  electronAffinityEv: 4.05,
  NcM3: perCm3ToPerM3(2.8e19),
  NvM3: perCm3ToPerM3(1.04e19),
};

export const GAAS_MATERIAL = {
  epsilonR: 13.1,
  bandGapEv: 1.42,
  electronAffinityEv: 4.07,
  NcM3: perCm3ToPerM3(4.7e17),
  NvM3: perCm3ToPerM3(8.6e18),
};

export const ALGAAS_MATERIAL = {
  epsilonR: 12.2,
  bandGapEv: 1.8,
  electronAffinityEv: 3.67,
  NcM3: perCm3ToPerM3(4.7e17),
  NvM3: perCm3ToPerM3(8.6e18),
  deltaEcEv: 0.38,
  deltaEvEv: 0.0,
};

export const GE_MATERIAL = {
  epsilonR: 16.0,
  bandGapEv: 0.66,
  electronAffinityEv: 4.0,
  NcM3: perCm3ToPerM3(1.04e19),
  NvM3: perCm3ToPerM3(6.0e18),
};

export const INP_MATERIAL = {
  epsilonR: 12.4,
  bandGapEv: 1.35,
  electronAffinityEv: 4.38,
  NcM3: perCm3ToPerM3(5.7e17),
  NvM3: perCm3ToPerM3(1.1e19),
};

export const INGAAS_MATERIAL = {
  epsilonR: 13.9,
  bandGapEv: 0.75,
  electronAffinityEv: 4.5,
  NcM3: perCm3ToPerM3(2.2e17),
  NvM3: perCm3ToPerM3(7.7e18),
};

export const GAN_MATERIAL = {
  epsilonR: 9.5,
  bandGapEv: 3.4,
  electronAffinityEv: 4.1,
  NcM3: perCm3ToPerM3(2.3e18),
  NvM3: perCm3ToPerM3(4.6e19),
};

export const ALGAN_MATERIAL = {
  epsilonR: 9.0,
  bandGapEv: 4.1,
  electronAffinityEv: 3.5,
  NcM3: perCm3ToPerM3(2.3e18),
  NvM3: perCm3ToPerM3(4.6e19),
};

export const SIC4H_MATERIAL = {
  epsilonR: 9.7,
  bandGapEv: 3.26,
  electronAffinityEv: 3.7,
  NcM3: perCm3ToPerM3(1.6e19),
  NvM3: perCm3ToPerM3(2.5e19),
};

export const ZNO_MATERIAL = {
  epsilonR: 8.5,
  bandGapEv: 3.3,
  electronAffinityEv: 4.35,
  NcM3: perCm3ToPerM3(2.8e18),
  NvM3: perCm3ToPerM3(1.8e19),
};

export const CDTE_MATERIAL = {
  epsilonR: 10.2,
  bandGapEv: 1.5,
  electronAffinityEv: 4.28,
  NcM3: perCm3ToPerM3(8.0e17),
  NvM3: perCm3ToPerM3(1.8e19),
};

export function makeMetalLayer(
  partial: Partial<Layer> & Pick<Layer, "workFunctionEv"> & { label?: string },
): Layer {
  return {
    kind: "metal",
    label: partial.label ?? "Metal",
    thicknessM: partial.thicknessM ?? 0,
    workFunctionEv: partial.workFunctionEv,
    epsilonR: 1,
    bandGapEv: 0,
    electronAffinityEv: 0,
    NdM3: 0,
    NaM3: 0,
    deltaEcEv: 0,
    deltaEvEv: 0,
    fermiLevelVacuumEv: partial.fermiLevelVacuumEv,
  };
}

export function makeLayer(
  partial: Partial<Layer> & Pick<Layer, "label" | "thicknessM" | "NdM3" | "NaM3">,
): Layer {
  return {
    kind: "semiconductor",
    epsilonR: SI_MATERIAL.epsilonR,
    bandGapEv: SI_MATERIAL.bandGapEv,
    electronAffinityEv: SI_MATERIAL.electronAffinityEv,
    NcM3: SI_MATERIAL.NcM3,
    NvM3: SI_MATERIAL.NvM3,
    deltaEcEv: 0,
    deltaEvEv: 0,
    ...partial,
  };
}

export function siPnStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "p-Si",
        thicknessM: nmToM(500),
        NaM3: perCm3ToPerM3(1e16),
        NdM3: 0,
      }),
      makeLayer({
        label: "n-Si",
        thicknessM: nmToM(500),
        NdM3: perCm3ToPerM3(1e16),
        NaM3: 0,
      }),
    ],
  };
}

export function siHetero3Stack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "p-GaAs",
        thicknessM: nmToM(200),
        ...GAAS_MATERIAL,
        NaM3: perCm3ToPerM3(1e16),
        NdM3: 0,
      }),
      makeLayer({
        label: "AlGaAs",
        thicknessM: nmToM(100),
        ...ALGAAS_MATERIAL,
        NdM3: perCm3ToPerM3(1e16),
        NaM3: 0,
        deltaEcEv: ALGAAS_MATERIAL.deltaEcEv,
        deltaEvEv: ALGAAS_MATERIAL.deltaEvEv,
      }),
      makeLayer({
        label: "n-GaAs",
        thicknessM: nmToM(200),
        ...GAAS_MATERIAL,
        NdM3: perCm3ToPerM3(1e16),
        NaM3: 0,
      }),
    ],
  };
}

/** n-Si Schottky diode: Au (metal row) on n-Si, ohmic back contact. */
export function siSchottkyNStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeMetalLayer({ label: "Au", workFunctionEv: 4.8 }),
      makeLayer({
        label: "n-Si",
        thicknessM: nmToM(1000),
        NdM3: perCm3ToPerM3(1e16),
        NaM3: 0,
      }),
    ],
  };
}

export function gePnStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "p-Ge",
        thicknessM: nmToM(400),
        ...GE_MATERIAL,
        NaM3: perCm3ToPerM3(5e15),
        NdM3: 0,
      }),
      makeLayer({
        label: "n-Ge",
        thicknessM: nmToM(400),
        ...GE_MATERIAL,
        NdM3: perCm3ToPerM3(5e15),
        NaM3: 0,
      }),
    ],
  };
}

export function inpIngaasStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "p-InP",
        thicknessM: nmToM(250),
        ...INP_MATERIAL,
        NaM3: perCm3ToPerM3(5e15),
        NdM3: 0,
      }),
      makeLayer({
        label: "i-InGaAs",
        thicknessM: nmToM(140),
        ...INGAAS_MATERIAL,
        NdM3: perCm3ToPerM3(1e14),
        NaM3: 0,
      }),
      makeLayer({
        label: "n-InP",
        thicknessM: nmToM(250),
        ...INP_MATERIAL,
        NdM3: perCm3ToPerM3(5e15),
        NaM3: 0,
      }),
    ],
  };
}

export function alganGanStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "AlGaN",
        thicknessM: nmToM(80),
        ...ALGAN_MATERIAL,
        NdM3: perCm3ToPerM3(5e15),
        NaM3: 0,
      }),
      makeLayer({
        label: "n-GaN",
        thicknessM: nmToM(400),
        ...GAN_MATERIAL,
        NdM3: perCm3ToPerM3(8e15),
        NaM3: 0,
      }),
    ],
  };
}

export function ganSchottkyStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeMetalLayer({ label: "Ni", workFunctionEv: 5.15 }),
      makeLayer({
        label: "n-GaN",
        thicknessM: nmToM(600),
        ...GAN_MATERIAL,
        NdM3: perCm3ToPerM3(5e15),
        NaM3: 0,
      }),
    ],
  };
}

export function sicSchottkyStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeMetalLayer({ label: "Ti", workFunctionEv: 4.33 }),
      makeLayer({
        label: "n-4H-SiC",
        thicknessM: nmToM(700),
        ...SIC4H_MATERIAL,
        NdM3: perCm3ToPerM3(5e15),
        NaM3: 0,
      }),
    ],
  };
}

export function znoCdteStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "n-ZnO",
        thicknessM: nmToM(180),
        ...ZNO_MATERIAL,
        NdM3: perCm3ToPerM3(5e15),
        NaM3: 0,
      }),
      makeLayer({
        label: "p-CdTe",
        thicknessM: nmToM(450),
        ...CDTE_MATERIAL,
        NaM3: perCm3ToPerM3(5e15),
        NdM3: 0,
      }),
    ],
  };
}

export function uniformNTypeStack(): LayerStack {
  return {
    temperatureK: 300,
    layers: [
      makeLayer({
        label: "n-Si",
        thicknessM: nmToM(200),
        NdM3: perCm3ToPerM3(1e15),
        NaM3: 0,
      }),
    ],
  };
}
