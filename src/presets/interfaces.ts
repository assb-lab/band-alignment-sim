import {
  alganGanStack,
  ganSchottkyStack,
  gePnStack,
  inpIngaasStack,
  siHetero3Stack,
  siPnStack,
  siSchottkyNStack,
  sicSchottkyStack,
  znoCdteStack,
} from "./materials.ts";

export { siPnStack } from "./materials.ts";

export const INTERFACE_PRESETS = [
  { name: "Si pn", stack: siPnStack },
  { name: "GaAs/AlGaAs 3-layer", stack: siHetero3Stack },
  { name: "Si Schottky", stack: siSchottkyNStack },
  { name: "Ge pn", stack: gePnStack },
  { name: "InP/InGaAs p-i-n", stack: inpIngaasStack },
  { name: "AlGaN/GaN", stack: alganGanStack },
  { name: "Ni/GaN Schottky", stack: ganSchottkyStack },
  { name: "Ti/4H-SiC Schottky", stack: sicSchottkyStack },
  { name: "ZnO/CdTe", stack: znoCdteStack },
];
