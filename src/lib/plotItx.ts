import { mToNm, perM3ToPerCm3 } from "../physics/units.ts";
import type {
  MaterialRegion,
  PreContactBandProfile,
  SimulationResult,
} from "../physics/types.ts";
import { buildIgorItx } from "./igorItx.ts";

export type SecondaryPlotTabForItx = "phi" | "field" | "carriers" | "rho";

export interface PreContactItxInput {
  bands: PreContactBandProfile;
  regions: MaterialRegion[];
}

export function postContactItx(result: SimulationResult): string {
  const xNm = Array.from(result.bands.xM ?? result.mesh.nodes.map((n) => n.xM)).map((xM) =>
    mToNm(xM),
  );
  return buildIgorItx({
    waves: [
      { name: "band_x_nm", values: xNm },
      { name: "band_Ec_eV", values: Array.from(result.bands.ecEv) },
      { name: "band_Ev_eV", values: Array.from(result.bands.evEv) },
      { name: "band_EF_eV", values: Array.from(result.bands.efnEv) },
    ],
    graph: {
      xWave: "band_x_nm",
      yWaves: [
        { waveName: "band_Ec_eV", color: "#ef0000", lineSize: 2 },
        { waveName: "band_Ev_eV", color: "#1747ff", lineSize: 2 },
        { waveName: "band_EF_eV", color: "#111827", lineSize: 1.5, dashed: true },
      ],
      xLabel: "Position [nm]",
      yLabel: "Energy [eV]",
    },
  });
}

export function preContactItx(preview: PreContactItxInput): string {
  return buildIgorItx({
    waves: [
      { name: "precontact_x_nm", values: Array.from(preview.bands.xM).map((xM) => mToNm(xM)) },
      { name: "precontact_Ec_eV", values: Array.from(preview.bands.ecEv) },
      { name: "precontact_Ev_eV", values: Array.from(preview.bands.evEv) },
      { name: "precontact_EF_eV", values: Array.from(preview.bands.efEv) },
    ],
    graph: {
      xWave: "precontact_x_nm",
      yWaves: [
        { waveName: "precontact_Ec_eV", color: "#ef0000", lineSize: 2 },
        { waveName: "precontact_Ev_eV", color: "#1747ff", lineSize: 2 },
        { waveName: "precontact_EF_eV", color: "#111827", lineSize: 1.5, dashed: true },
      ],
      xLabel: "Position [nm]",
      yLabel: "Energy vs vacuum [eV]",
    },
  });
}

export function secondaryPlotData(
  result: SimulationResult,
  tab: SecondaryPlotTabForItx,
): { values: number[]; yLabel: string; waveName: string; logScale: boolean } {
  switch (tab) {
    case "phi":
      return {
        values: Array.from(result.phiV),
        yLabel: "φ [V]",
        waveName: "phi_V",
        logScale: false,
      };
    case "field":
      return {
        values: Array.from(result.fieldVm),
        yLabel: "E [V/m]",
        waveName: "field_Vm",
        logScale: false,
      };
    case "carriers":
      return {
        values: Array.from(result.nM3).map((v, i) => perM3ToPerCm3(Math.max(v, result.pM3[i]!))),
        yLabel: "n,p [cm⁻³] (max envelope)",
        waveName: "carriers_cm3",
        logScale: true,
      };
    case "rho":
      return {
        values: Array.from(result.rhoCm3),
        yLabel: "ρ [C/m³]",
        waveName: "rho_Cm3",
        logScale: false,
      };
  }
}

export function secondaryPlotDisplayData(
  result: SimulationResult,
  tab: SecondaryPlotTabForItx,
): { xNm: number[]; values: number[]; yLabel: string; waveName: string; logScale: boolean } {
  const data = secondaryPlotData(result, tab);
  const xNm = Array.from(result.bands.xM ?? result.mesh.nodes.map((node) => node.xM)).map((xM) =>
    mToNm(xM),
  );
  const values: number[] = [];
  let semiconductorIndex = 0;
  for (const kind of result.bands.layerKind ?? []) {
    if (kind === "metal") {
      if (tab === "phi") {
        const boundaryPhi =
          semiconductorIndex === 0
            ? result.phiV[0]
            : result.phiV[result.phiV.length - 1];
        values.push(boundaryPhi ?? Number.NaN);
      } else {
        values.push(Number.NaN);
      }
      continue;
    }
    values.push(data.values[semiconductorIndex] ?? Number.NaN);
    semiconductorIndex++;
  }

  if (values.length === xNm.length) {
    return { ...data, xNm, values };
  }
  return { ...data, xNm: result.mesh.nodes.map((node) => mToNm(node.xM)), values: data.values };
}

export function secondaryPlotItx(result: SimulationResult, tab: SecondaryPlotTabForItx): string {
  const data = secondaryPlotDisplayData(result, tab);
  return buildIgorItx({
    waves: [
      { name: `${tab}_x_nm`, values: data.xNm },
      { name: data.waveName, values: data.values },
    ],
    graph: {
      xWave: `${tab}_x_nm`,
      yWaves: [{ waveName: data.waveName, color: "#4f46e5", lineSize: 2 }],
      xLabel: "Position [nm]",
      yLabel: data.yLabel,
    },
  });
}
