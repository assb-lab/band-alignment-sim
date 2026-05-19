import type {
  BandProfile,
  Mesh,
  PreContactBandProfile,
  SimulationResult,
} from "../physics/types.ts";

/** Serializable simulation output for postMessage (ArrayBuffers are transferable). */
export interface SimulationResultPayload {
  mesh: Mesh;
  bands: {
    xM?: ArrayBuffer;
    layerKind?: SimulationResult["bands"]["layerKind"];
    ecEv: ArrayBuffer;
    evEv: ArrayBuffer;
    efnEv: ArrayBuffer;
    efpEv: ArrayBuffer;
  };
  preContactBands: {
    xM: ArrayBuffer;
    layerKind: SimulationResult["preContactBands"]["layerKind"];
    ecEv: ArrayBuffer;
    evEv: ArrayBuffer;
    efEv: ArrayBuffer;
  };
  phiV: ArrayBuffer;
  nM3: ArrayBuffer;
  pM3: ArrayBuffer;
  rhoCm3: ArrayBuffer;
  fieldVm: ArrayBuffer;
  fermiLevelEv: number;
  appliedVoltageV: number;
  builtInVoltageV: number;
  converged: boolean;
  iterations: number;
  contactLeft: SimulationResult["contactLeft"];
  contactRight: SimulationResult["contactRight"];
  materialRegions: SimulationResult["materialRegions"];
  preContactMaterialRegions: SimulationResult["preContactMaterialRegions"];
}

function copyBuffer(arr: Float64Array): ArrayBuffer {
  const copy = new Float64Array(arr.length);
  copy.set(arr);
  return copy.buffer;
}

export function packSimulationResult(
  result: SimulationResult,
): { payload: SimulationResultPayload; transfer: Transferable[] } {
  const ecEv = copyBuffer(result.bands.ecEv);
  const evEv = copyBuffer(result.bands.evEv);
  const efnEv = copyBuffer(result.bands.efnEv);
  const efpEv = copyBuffer(result.bands.efpEv);
  const bandXM = result.bands.xM ? copyBuffer(result.bands.xM) : undefined;
  const phiV = copyBuffer(result.phiV);
  const preContactXM = copyBuffer(result.preContactBands.xM);
  const preContactEcEv = copyBuffer(result.preContactBands.ecEv);
  const preContactEvEv = copyBuffer(result.preContactBands.evEv);
  const preContactEfEv = copyBuffer(result.preContactBands.efEv);
  const nM3 = copyBuffer(result.nM3);
  const pM3 = copyBuffer(result.pM3);
  const rhoCm3 = copyBuffer(result.rhoCm3);
  const fieldVm = copyBuffer(result.fieldVm);

  return {
    payload: {
      mesh: result.mesh,
      bands: {
        xM: bandXM,
        layerKind: result.bands.layerKind,
        ecEv,
        evEv,
        efnEv,
        efpEv,
      },
      preContactBands: {
        xM: preContactXM,
        layerKind: result.preContactBands.layerKind,
        ecEv: preContactEcEv,
        evEv: preContactEvEv,
        efEv: preContactEfEv,
      },
      phiV,
      nM3,
      pM3,
      rhoCm3,
      fieldVm,
      fermiLevelEv: result.fermiLevelEv,
      appliedVoltageV: result.appliedVoltageV,
      builtInVoltageV: result.builtInVoltageV,
      converged: result.converged,
      iterations: result.iterations,
      contactLeft: result.contactLeft,
      contactRight: result.contactRight,
      materialRegions: result.materialRegions,
      preContactMaterialRegions: result.preContactMaterialRegions,
    },
    transfer: [
      ...(bandXM ? [bandXM] : []),
      ecEv,
      evEv,
      efnEv,
      efpEv,
      preContactXM,
      preContactEcEv,
      preContactEvEv,
      preContactEfEv,
      phiV,
      nM3,
      pM3,
      rhoCm3,
      fieldVm,
    ],
  };
}

export function unpackSimulationResult(payload: SimulationResultPayload): SimulationResult {
  const bands: BandProfile = {
    xM: payload.bands.xM ? new Float64Array(payload.bands.xM) : undefined,
    layerKind: payload.bands.layerKind,
    ecEv: new Float64Array(payload.bands.ecEv),
    evEv: new Float64Array(payload.bands.evEv),
    efnEv: new Float64Array(payload.bands.efnEv),
    efpEv: new Float64Array(payload.bands.efpEv),
  };
  const preContactBands: PreContactBandProfile = {
    xM: new Float64Array(payload.preContactBands.xM),
    layerKind: payload.preContactBands.layerKind,
    ecEv: new Float64Array(payload.preContactBands.ecEv),
    evEv: new Float64Array(payload.preContactBands.evEv),
    efEv: new Float64Array(payload.preContactBands.efEv),
  };
  return {
    mesh: payload.mesh,
    bands,
    preContactBands,
    phiV: new Float64Array(payload.phiV),
    nM3: new Float64Array(payload.nM3),
    pM3: new Float64Array(payload.pM3),
    rhoCm3: new Float64Array(payload.rhoCm3),
    fieldVm: new Float64Array(payload.fieldVm),
    fermiLevelEv: payload.fermiLevelEv,
    appliedVoltageV: payload.appliedVoltageV,
    builtInVoltageV: payload.builtInVoltageV,
    converged: payload.converged,
    iterations: payload.iterations,
    contactLeft: payload.contactLeft,
    contactRight: payload.contactRight,
    materialRegions: payload.materialRegions,
    preContactMaterialRegions: payload.preContactMaterialRegions,
  };
}
