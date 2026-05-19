export type LayerKind = "semiconductor" | "metal";

/** Stack layer: semiconductor (meshed) or metal (boundary-only, not meshed). */
export interface Layer {
  kind: LayerKind;
  label: string;
  thicknessM: number;
  /** Metal work function Φ_m [eV]; used when kind === "metal" */
  workFunctionEv?: number;
  epsilonR: number;
  bandGapEv: number;
  electronAffinityEv: number;
  /** Effective density of states [m^-3]; optional if niM3 is set */
  NcM3?: number;
  NvM3?: number;
  /** Intrinsic carrier density [m^-3]; overrides Nc/Nv if set */
  niM3?: number;
  NdM3: number;
  NaM3: number;
  /** Band offset vs layer below (first layer uses 0) [eV] */
  deltaEcEv: number;
  deltaEvEv: number;
  /** Pre-contact Fermi level on an absolute vacuum-referenced energy axis [eV] */
  fermiLevelVacuumEv?: number;
}

export type ContactKind = "ohmic" | "schottky";
export type ElectrodeMode = "shorted" | "open" | "bias";

/** Boundary at stack end (left = first layer surface, right = last layer surface). */
export interface ContactBoundary {
  kind: ContactKind;
  /** Metal work function Φ_m [eV] (vacuum reference, same as χ). Required for Schottky. */
  workFunctionEv?: number;
}

export const OHMIC_CONTACT: ContactBoundary = { kind: "ohmic" };

export interface LayerStack {
  layers: Layer[];
  temperatureK: number;
}

export interface SolverOptions {
  /** Approximate nodes per nm */
  nodesPerNm: number;
  /** Minimum nodes per layer */
  minNodesPerLayer: number;
  /** Gummel / Newton tolerance */
  tol: number;
  /** Maximum Gummel iterations */
  maxGummelIter: number;
  /** Maximum Newton iterations per Poisson solve */
  maxNewtonIter: number;
  /** Optional maximum normalized Poisson residual accepted as converged */
  maxRelativeResidual?: number;
  /** Applied bias [V] (positive = forward on p→n direction, left to right) */
  Vapp: number;
  /** How EF is assigned when both ends are metal Schottky contacts */
  electrodeMode?: ElectrodeMode;
  /** Left (first-layer) contact; default ohmic */
  contactLeft?: ContactBoundary;
  /** Right (last-layer) contact; default ohmic */
  contactRight?: ContactBoundary;
}

export const DEFAULT_SOLVER_OPTIONS: SolverOptions = {
  nodesPerNm: 2,
  minNodesPerLayer: 40,
  tol: 1e-6,
  maxGummelIter: 80,
  maxNewtonIter: 800,
  Vapp: 0,
};

export interface MeshNode {
  xM: number;
  layerIndex: number;
  epsilonR: number;
  niM3: number;
  NcM3: number;
  NvM3: number;
  NdM3: number;
  NaM3: number;
  /** Conduction band reference (without electrostatic potential) [eV] */
  ecRefEv: number;
  /** Valence band reference [eV] */
  evRefEv: number;
}

export interface Mesh {
  nodes: MeshNode[];
  dxM: number[];
  lengthM: number;
}

export interface BandProfile {
  xM?: Float64Array;
  layerKind?: LayerKind[];
  ecEv: Float64Array;
  evEv: Float64Array;
  efnEv: Float64Array;
  efpEv: Float64Array;
}

export interface PreContactBandProfile {
  xM: Float64Array;
  layerKind: LayerKind[];
  /** Vacuum-referenced conduction band before contact [eV], vacuum = 0 */
  ecEv: Float64Array;
  /** Vacuum-referenced valence band before contact [eV], vacuum = 0 */
  evEv: Float64Array;
  /** Vacuum-referenced layer Fermi level before contact [eV], vacuum = 0 */
  efEv: Float64Array;
}

export interface MaterialRegion {
  label: string;
  layerIndex: number;
  xStartM: number;
  xEndM: number;
}

export interface ContactResultSummary {
  kind: ContactKind;
  workFunctionEv: number;
  fermiEv: number;
  phiBnEv?: number;
  phiBpEv?: number;
}

export interface SimulationResult {
  mesh: Mesh;
  phiV: Float64Array;
  nM3: Float64Array;
  pM3: Float64Array;
  rhoCm3: Float64Array;
  fieldVm: Float64Array;
  bands: BandProfile;
  preContactBands: PreContactBandProfile;
  preContactMaterialRegions: MaterialRegion[];
  materialRegions: MaterialRegion[];
  fermiLevelEv: number;
  appliedVoltageV: number;
  builtInVoltageV: number;
  converged: boolean;
  iterations: number;
  contactLeft: ContactResultSummary;
  contactRight: ContactResultSummary;
}

export class ConvergenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConvergenceError";
  }
}
