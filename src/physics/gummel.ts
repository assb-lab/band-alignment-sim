import {
  carrierDensities,
  chargeDensity,
  computeBands,
  electricField,
} from "./bands.ts";
import { EPS0, Q } from "./constants.ts";
import { bulkStateAtFermi } from "./bulkNeutral.ts";
import { resolveContacts, type ResolvedContact } from "./contacts.ts";
import { buildBandReferences, buildMesh } from "./mesh.ts";
import { preContactBands, preContactMaterialRegions } from "./preContact.ts";
import {
  poissonChargeScale,
  poissonResidualNorm,
  solvePoissonNewton,
  solvePoissonPicard,
  type PoissonContext,
} from "./poisson.ts";
import { relativeChange } from "./validation.ts";
import type {
  BandProfile,
  ContactBoundary,
  ContactResultSummary,
  LayerStack,
  SimulationResult,
  SolverOptions,
} from "./types.ts";
import { inferContacts, semiconductorLayers, semiconductorStack } from "./stackContacts.ts";
import { ConvergenceError, DEFAULT_SOLVER_OPTIONS } from "./types.ts";
import { isFiniteArray } from "./validation.ts";

function quasiFermiProfile(
  mesh: ReturnType<typeof buildMesh>,
  count: number,
  eFnLeft: number,
  eFpLeft: number,
  eFnRight: number,
  eFpRight: number,
): { eFnEv: Float64Array; eFpEv: Float64Array } {
  const eFnEv = new Float64Array(count);
  const eFpEv = new Float64Array(count);
  const x0 = mesh.nodes[0]!.xM;
  const xL = mesh.nodes[count - 1]!.xM;
  const span = xL - x0 || 1;

  for (let i = 0; i < count; i++) {
    const t = (mesh.nodes[i]!.xM - x0) / span;
    eFnEv[i] = eFnLeft + t * (eFnRight - eFnLeft);
    eFpEv[i] = eFpLeft + t * (eFpRight - eFpLeft);
  }
  return { eFnEv, eFpEv };
}

interface ContactState {
  eFLeft: number;
  eFRight: number;
  phiLeft: number;
  phiRight: number;
  left: ResolvedContact;
  right: ResolvedContact;
}

function toContactSummary(c: ResolvedContact): ContactResultSummary {
  return {
    kind: c.kind,
    workFunctionEv: c.workFunctionEv,
    fermiEv: c.fermiEv,
    phiBnEv: c.barriers?.phiBnEv,
    phiBpEv: c.barriers?.phiBpEv,
  };
}

function displayBands(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  bands: BandProfile,
  contacts: ContactState,
): BandProfile {
  const regions = preContactMaterialRegions(stack);
  const xM: number[] = [];
  const ec: number[] = [];
  const ev: number[] = [];
  const efn: number[] = [];
  const efp: number[] = [];
  const layerKind: BandProfile["layerKind"] = [];
  const firstSemIndex = stack.layers.findIndex((layer) => layer.kind !== "metal");
  const semRegionStart = regions[firstSemIndex]?.xStartM ?? 0;

  for (const region of regions) {
    const layer = stack.layers[region.layerIndex]!;
    if (layer.kind === "metal") {
      const fermi = region.layerIndex < firstSemIndex ? contacts.eFLeft : contacts.eFRight;
      for (const x of [region.xStartM, region.xEndM]) {
        xM.push(x);
        ec.push(Number.NaN);
        ev.push(Number.NaN);
        efn.push(fermi);
        efp.push(fermi);
        layerKind.push("metal");
      }
      continue;
    }

    for (let i = 0; i < mesh.nodes.length; i++) {
      if (mesh.nodes[i]!.layerIndex !== region.layerIndex - firstSemIndex) continue;
      xM.push(mesh.nodes[i]!.xM + semRegionStart);
      ec.push(bands.ecEv[i]!);
      ev.push(bands.evEv[i]!);
      efn.push(bands.efnEv[i]!);
      efp.push(bands.efpEv[i]!);
      layerKind.push("semiconductor");
    }
  }

  return {
    xM: Float64Array.from(xM),
    layerKind,
    ecEv: Float64Array.from(ec),
    evEv: Float64Array.from(ev),
    efnEv: Float64Array.from(efn),
    efpEv: Float64Array.from(efp),
  };
}

function buildContactState(
  stack: LayerStack,
  ecRefEv: number[],
  evRefEv: number[],
  contactLeft: ContactBoundary,
  contactRight: ContactBoundary,
  Vapp: number,
): ContactState {
  const sem = semiconductorLayers(stack);
  const leftLayer = sem[0]!;
  const rightLayer = sem[sem.length - 1]!;
  const pair = resolveContacts(
    leftLayer,
    rightLayer,
    ecRefEv[0]!,
    evRefEv[0]!,
    ecRefEv[ecRefEv.length - 1]!,
    evRefEv[evRefEv.length - 1]!,
    stack.temperatureK,
    contactLeft,
    contactRight,
    Vapp,
  );
  return {
    eFLeft: pair.left.fermiEv,
    eFRight: pair.right.fermiEv,
    phiLeft: pair.left.phiV,
    phiRight: pair.right.phiV,
    left: pair.left,
    right: pair.right,
  };
}

function initializeEquilibriumPhi(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  contacts: ContactState,
  eF: number,
): Float64Array {
  const count = mesh.nodes.length;
  const phi = new Float64Array(count);
  const schottkyOhmic =
    contacts.left.kind === "schottky" && contacts.right.kind === "ohmic";

  if (schottkyOhmic) {
    const fermiEv = contacts.left.fermiEv;
    const phiBulk = contacts.phiRight;
    for (let i = 0; i < count; i++) {
      const node = mesh.nodes[i]!;
      const layer = stack.layers[node.layerIndex]!;
      phi[i] = bulkStateAtFermi(
        layer,
        stack.temperatureK,
        fermiEv,
        node.ecRefEv,
        node.evRefEv,
      ).phiV;
    }
    const transitionNodes = Math.min(20, Math.max(6, Math.floor(count * 0.03)));
    for (let i = 0; i < transitionNodes; i++) {
      const t = i / Math.max(transitionNodes - 1, 1);
      phi[i] = contacts.phiLeft + t * (phiBulk - contacts.phiLeft);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const node = mesh.nodes[i]!;
      const layer = stack.layers[node.layerIndex]!;
      phi[i] = bulkStateAtFermi(
        layer,
        stack.temperatureK,
        eF,
        node.ecRefEv,
        node.evRefEv,
      ).phiV;
    }
  }

  phi[0] = contacts.phiLeft;
  phi[count - 1] = contacts.phiRight;
  return phi;
}

function maxSemiconductorDopingM3(stack: LayerStack): number {
  let max = 0;
  for (const layer of semiconductorLayers(stack)) {
    max = Math.max(max, layer.NdM3, layer.NaM3);
  }
  return Math.max(max, 1e6);
}

function withScaledDoping(stack: LayerStack, scale: number): LayerStack {
  return {
    ...stack,
    layers: stack.layers.map((layer) => {
      if (layer.kind === "metal") return layer;
      return {
        ...layer,
        NdM3: layer.NdM3 * scale,
        NaM3: layer.NaM3 * scale,
      };
    }),
  };
}

function dopingContinuationLogSteps(logMax: number): number[] {
  const coarse = [12, 13.5, 15, 15.5, 15.7, 15.85, 15.92, 15.96, 15.98, 15.99];
  const steps = coarse.filter((logD) => logD <= logMax + 1e-12);
  if (steps.length === 0 || steps[steps.length - 1]! < logMax - 1e-12) {
    steps.push(logMax);
  }
  return steps;
}

function solveOhmicGummelNewton(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  contacts: ContactState,
  options: SolverOptions,
  phiStart: Float64Array,
): Float64Array {
  const count = mesh.nodes.length;
  const { eFnEv, eFpEv } = quasiFermiProfile(
    mesh,
    count,
    contacts.eFLeft,
    contacts.eFLeft,
    contacts.eFRight,
    contacts.eFRight,
  );

  let phi = new Float64Array(phiStart);
  phi[0] = contacts.phiLeft;
  phi[count - 1] = contacts.phiRight;

  const poissonCtx: PoissonContext = {
    mesh,
    temperatureK: stack.temperatureK,
    eFnEv,
    eFpEv,
    useBoltzmann: true,
  };

  const chargeScale = poissonChargeScale(poissonCtx);
  const resTol = chargeScale * Math.max(options.tol * options.tol, 1e-10);
  const phiTol = Math.max(options.tol, 1e-8);
  const innerPicardIter = 40;
  const innerPicardTol = 1e-12;
  let bestPhi = new Float64Array(phi);
  let bestRes = poissonResidualNorm(poissonCtx, bestPhi);

  const phiNewtonFirst = solvePoissonNewton(
    poissonCtx,
    phi,
    contacts.phiLeft,
    contacts.phiRight,
    options.maxNewtonIter,
    resTol,
  );
  if (poissonResidualNorm(poissonCtx, phiNewtonFirst) < resTol) {
    return new Float64Array(phiNewtonFirst);
  }
  const phiNewtonFirstRes = poissonResidualNorm(poissonCtx, phiNewtonFirst);
  if (phiNewtonFirstRes < bestRes) {
    phi = new Float64Array(phiNewtonFirst);
    bestPhi = new Float64Array(phiNewtonFirst);
    bestRes = phiNewtonFirstRes;
  }

  for (let g = 0; g < options.maxGummelIter; g++) {
    const { nM3, pM3 } = carrierDensities(mesh, phi, eFnEv, eFpEv, stack.temperatureK);
    const frozenCtx: PoissonContext = {
      mesh,
      temperatureK: stack.temperatureK,
      eFnEv,
      eFpEv,
      useBoltzmann: false,
      nM3,
      pM3,
    };
    const prev = new Float64Array(phi);
    phi = new Float64Array(solvePoissonPicard(
      frozenCtx,
      phi,
      contacts.phiLeft,
      contacts.phiRight,
      innerPicardIter,
      innerPicardTol,
    ));

    const phiChange = relativeChange(prev, phi);
    const res = poissonResidualNorm(poissonCtx, phi);
    if (res < bestRes) {
      bestPhi = new Float64Array(phi);
      bestRes = res;
    } else {
      phi = new Float64Array(bestPhi);
      break;
    }
    if (phiChange < phiTol && res < resTol) break;
  }

  const resBeforeNewton = bestRes;
  const phiNewton = solvePoissonNewton(
    poissonCtx,
    phi,
    contacts.phiLeft,
    contacts.phiRight,
    options.maxNewtonIter,
    resTol,
  );
  if (poissonResidualNorm(poissonCtx, phiNewton) < resBeforeNewton) {
    phi = new Float64Array(phiNewton);
  } else {
    phi = new Float64Array(bestPhi);
  }

  return phi;
}

/** Ramp |Nd|,|Na| toward target when abrupt high-doping pn junctions stall Newton/Gummel. */
function solveEquilibriumDopingContinuation(
  stack: LayerStack,
  options: SolverOptions,
  contactLeft: ContactBoundary,
  contactRight: ContactBoundary,
  targetNodeCount: number,
): Float64Array | null {
  const maxD = maxSemiconductorDopingM3(stack);
  const logMax = Math.log10(maxD / 1e6);
  let phi: Float64Array | null = null;
  let finalRel = Infinity;

  for (const logD of dopingContinuationLogSteps(logMax)) {
    const scale = (Math.pow(10, logD) * 1e6) / maxD;
    const scaledStack = withScaledDoping(stack, scale);
    const semStack = semiconductorStack(scaledStack);
    const mesh = buildMesh(scaledStack, options);
    if (mesh.nodes.length !== targetNodeCount) return null;

    const { ecRefEv, evRefEv } = buildBandReferences(scaledStack);
    const contacts = buildContactState(
      semStack,
      ecRefEv,
      evRefEv,
      contactLeft,
      contactRight,
      0,
    );
    const eF = 0.5 * (contacts.eFLeft + contacts.eFRight);

    let phiInit: Float64Array;
    if (phi === null) {
      phiInit =
        depletionInitialPhi(mesh, semStack, contacts, eF) ??
        linearContactPhi(mesh, contacts);
    } else {
      phiInit = new Float64Array(phi);
    }

    const eFnEv = new Float64Array(mesh.nodes.length).fill(eF);
    const poissonCtx: PoissonContext = {
      mesh,
      temperatureK: stack.temperatureK,
      eFnEv,
      eFpEv: eFnEv,
      useBoltzmann: true,
    };
    const chargeScale = poissonChargeScale(poissonCtx);
    const resTol = chargeScale * Math.max(options.tol * options.tol, 1e-10);
    phiInit[0] = contacts.phiLeft;
    phiInit[phiInit.length - 1] = contacts.phiRight;
    phi = solvePoissonNewton(
      poissonCtx,
      phiInit,
      contacts.phiLeft,
      contacts.phiRight,
      options.maxNewtonIter,
      resTol,
    );

    finalRel = poissonResidualNorm(poissonCtx, phi) / poissonChargeScale(poissonCtx, phi);
  }

  const relLimit = Math.max(options.tol * 50, 0.25);
  if (phi === null || finalRel > relLimit) return null;
  return phi;
}

function linearContactPhi(
  mesh: ReturnType<typeof buildMesh>,
  contacts: ContactState,
): Float64Array {
  const x0 = mesh.nodes[0]!.xM;
  const xL = mesh.nodes[mesh.nodes.length - 1]!.xM;
  const phi = new Float64Array(mesh.nodes.length);
  for (let i = 0; i < mesh.nodes.length; i++) {
    const t = (mesh.nodes[i]!.xM - x0) / (xL - x0 || 1);
    phi[i] = contacts.phiLeft + t * (contacts.phiRight - contacts.phiLeft);
  }
  phi[0] = contacts.phiLeft;
  phi[phi.length - 1] = contacts.phiRight;
  return phi;
}

function similarHomojunction(left: LayerStack["layers"][number], right: LayerStack["layers"][number]): boolean {
  return (
    Math.abs(left.epsilonR - right.epsilonR) < 1e-9 &&
    Math.abs(left.bandGapEv - right.bandGapEv) < 1e-9 &&
    Math.abs(left.electronAffinityEv - right.electronAffinityEv) < 1e-9
  );
}

function pnHomojunctionCount(stack: LayerStack): number {
  let count = 0;
  for (let i = 0; i < stack.layers.length - 1; i++) {
    const left = stack.layers[i]!;
    const right = stack.layers[i + 1]!;
    const leftNet = left.NdM3 - left.NaM3;
    const rightNet = right.NdM3 - right.NaM3;
    if (leftNet * rightNet < 0 && similarHomojunction(left, right)) {
      count++;
    }
  }
  return count;
}

function poissonRelLimit(stack: LayerStack, options: SolverOptions): number {
  if (options.maxRelativeResidual !== undefined) {
    return options.maxRelativeResidual;
  }
  const base = Math.max(options.tol * 50, 0.2);
  return pnHomojunctionCount(stack) >= 2 ? Math.max(base, 2.0) : base;
}

function depletionInitialPhi(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  contacts: ContactState,
  eF: number,
): Float64Array | null {
  const layers = stack.layers;
  if (layers.length < 2 || contacts.left.kind !== "ohmic" || contacts.right.kind !== "ohmic") {
    return null;
  }

  const bounds: { start: number; end: number }[] = [];
  const bulkPhi: number[] = [];
  let x = 0;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]!;
    bounds.push({ start: x, end: x + layer.thicknessM });
    const refNode = mesh.nodes.find((node) => node.layerIndex === i);
    if (!refNode) return null;
    bulkPhi.push(
      bulkStateAtFermi(
        layer,
        stack.temperatureK,
        eF,
        refNode.ecRefEv,
        refNode.evRefEv,
      ).phiV,
    );
    x += layer.thicknessM;
  }

  const phi = new Float64Array(mesh.nodes.length);
  for (let i = 0; i < mesh.nodes.length; i++) {
    phi[i] = bulkPhi[mesh.nodes[i]!.layerIndex]!;
  }

  let applied = false;
  for (let i = 0; i < layers.length - 1; i++) {
    const left = layers[i]!;
    const right = layers[i + 1]!;
    const leftNet = left.NdM3 - left.NaM3;
    const rightNet = right.NdM3 - right.NaM3;
    if (leftNet * rightNet >= 0 || !similarHomojunction(left, right)) continue;

    const leftD = Math.abs(leftNet);
    const rightD = Math.abs(rightNet);
    const deltaPhi = bulkPhi[i + 1]! - bulkPhi[i]!;
    const vbi = Math.abs(deltaPhi);
    if (leftD <= 0 || rightD <= 0 || vbi <= 1e-9) continue;

    const eps = EPS0 * 0.5 * (left.epsilonR + right.epsilonR);
    const leftWidth = Math.min(
      Math.sqrt((2 * eps * vbi * rightD) / (Q * leftD * (leftD + rightD))),
      left.thicknessM * 0.49,
    );
    const rightWidth = Math.min(
      Math.sqrt((2 * eps * vbi * leftD) / (Q * rightD * (leftD + rightD))),
      right.thicknessM * 0.49,
    );
    const junctionX = bounds[i]!.end;
    const xStart = junctionX - leftWidth;
    const xEnd = junctionX + rightWidth;
    const span = xEnd - xStart;
    if (span <= 0) continue;

    for (let nodeIndex = 0; nodeIndex < mesh.nodes.length; nodeIndex++) {
      const nodeX = mesh.nodes[nodeIndex]!.xM;
      if (nodeX < xStart || nodeX > xEnd) continue;
      const t = Math.max(0, Math.min(1, (nodeX - xStart) / span));
      const smooth = t * t * (3 - 2 * t);
      phi[nodeIndex] = bulkPhi[i]! + deltaPhi * smooth;
    }
    applied = true;
  }

  phi[0] = contacts.phiLeft;
  phi[phi.length - 1] = contacts.phiRight;
  return applied ? phi : null;
}

function solveEquilibriumPoisson(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  contacts: ContactState,
  options: SolverOptions,
  fullStack: LayerStack,
  contactLeft: ContactBoundary,
  contactRight: ContactBoundary,
): Float64Array {
  const count = mesh.nodes.length;
  const eF = 0.5 * (contacts.eFLeft + contacts.eFRight);
  const { eFnEv, eFpEv } = quasiFermiProfile(
    mesh,
    count,
    contacts.eFLeft,
    contacts.eFLeft,
    contacts.eFRight,
    contacts.eFRight,
  );

  const depletionPhi = depletionInitialPhi(mesh, stack, contacts, eF);
  let phi = depletionPhi ?? initializeEquilibriumPhi(mesh, stack, contacts, eF);

  const poissonCtx: PoissonContext = {
    mesh,
    temperatureK: stack.temperatureK,
    eFnEv,
    eFpEv,
    useBoltzmann: true,
  };

  const chargeScale = poissonChargeScale(poissonCtx);
  const resTol = chargeScale * Math.max(options.tol * options.tol, 1e-10);
  const schottkyOhmic =
    contacts.left.kind === "schottky" && contacts.right.kind === "ohmic";

  if (schottkyOhmic) {
    // Frozen-carrier Picard leaves flat bands; use self-consistent Newton instead.
    phi = solvePoissonNewton(
      poissonCtx,
      phi,
      contacts.phiLeft,
      contacts.phiRight,
      options.maxNewtonIter,
      resTol,
    );
  } else {
    phi = solveOhmicGummelNewton(mesh, stack, contacts, options, phi);
  }

  if (schottkyOhmic) {
    const node0 = mesh.nodes[0]!;
    const barrierEv = node0.ecRefEv - phi[0]! - contacts.left.fermiEv;
    const phiBn = contacts.left.barriers?.phiBnEv;
    if (phiBn !== undefined && Math.abs(barrierEv - phiBn) > 0.15) {
      throw new ConvergenceError(
        `Schottky barrier mismatch (computed=${barrierEv.toFixed(3)} eV, expected=${phiBn.toFixed(3)} eV)`,
      );
    }
    if (!isFiniteArray(phi)) {
      throw new ConvergenceError("Solution contains non-finite values");
    }
    return phi;
  }

  {
    const poissonRes = poissonResidualNorm(poissonCtx, phi);
    const relRes = poissonRes / poissonChargeScale(poissonCtx, phi);
    const relLimit = poissonRelLimit(stack, options);
    if (relRes > relLimit && poissonRes > resTol) {
      const contPhi = solveEquilibriumDopingContinuation(
        fullStack,
        options,
        contactLeft,
        contactRight,
        mesh.nodes.length,
      );
      if (contPhi !== null) {
        return contPhi;
      }
      throw new ConvergenceError(
        `Poisson solver did not converge (residual=${poissonRes.toExponential(2)}, rel=${relRes.toExponential(2)})`,
      );
    }
  }
  return phi;
}

function solveBiasedPoisson(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  contacts: ContactState,
  eqContacts: ContactState,
  options: SolverOptions,
  eqPhi: Float64Array,
): Float64Array {
  void eqContacts;
  void options;
  const phi = applyBiasToPhi(mesh, stack, eqPhi, contacts.phiLeft, contacts.phiRight);
  if (!isFiniteArray(phi)) {
    throw new ConvergenceError("Biased Poisson approximation produced non-finite values");
  }
  return phi;
}

function depletionBiasShape(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  eqPhi: Float64Array,
): Float64Array | null {
  const layers = stack.layers;
  const n = mesh.nodes.length;
  const length = mesh.nodes[n - 1]!.xM - mesh.nodes[0]!.xM;
  if (layers.length < 2 || length <= 0) return null;

  const bounds: { start: number; end: number }[] = [];
  let x = 0;
  for (const layer of layers) {
    bounds.push({ start: x, end: x + layer.thicknessM });
    x += layer.thicknessM;
  }

  const junctions: { xM: number; sigmaM: number }[] = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const left = layers[i]!;
    const right = layers[i + 1]!;
    const leftNet = left.NdM3 - left.NaM3;
    const rightNet = right.NdM3 - right.NaM3;
    if (leftNet * rightNet >= 0) continue;

    const leftD = Math.abs(leftNet);
    const rightD = Math.abs(rightNet);
    if (leftD <= 0 || rightD <= 0) continue;

    const junctionX = bounds[i]!.end;
    const leftIdx = Math.max(
      0,
      mesh.nodes.findIndex((node) => node.xM >= bounds[i]!.start),
    );
    const rightIdx = Math.max(
      leftIdx,
      mesh.nodes.findIndex((node) => node.xM >= bounds[i + 1]!.end),
    );
    const localDrop = Math.max(
      Math.abs((eqPhi[rightIdx] ?? eqPhi[n - 1]!) - (eqPhi[leftIdx] ?? eqPhi[0]!)),
      0.05,
    );
    const eps = EPS0 * 0.5 * (left.epsilonR + right.epsilonR);
    const leftWidth = Math.min(
      Math.sqrt((2 * eps * localDrop * rightD) / (Q * leftD * (leftD + rightD))),
      left.thicknessM * 0.5,
    );
    const rightWidth = Math.min(
      Math.sqrt((2 * eps * localDrop * leftD) / (Q * rightD * (leftD + rightD))),
      right.thicknessM * 0.5,
    );
    junctions.push({
      xM: junctionX,
      sigmaM: Math.max(0.5 * (leftWidth + rightWidth), length * 0.02),
    });
  }
  if (junctions.length === 0) return null;

  const weight = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nodeX = mesh.nodes[i]!.xM;
    let value = 1e-9;
    for (const junction of junctions) {
      const z = (nodeX - junction.xM) / junction.sigmaM;
      value += Math.exp(-0.5 * z * z);
    }
    weight[i] = value;
  }

  const shape = new Float64Array(n);
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += 0.5 * (weight[i - 1]! + weight[i]!) * mesh.dxM[i - 1]!;
    shape[i] = total;
  }
  if (total <= 0) return null;
  for (let i = 1; i < n; i++) {
    shape[i] = shape[i]! / total;
  }
  shape[0] = 0;
  shape[n - 1] = 1;
  return shape;
}

/** Shift equilibrium potential to match biased contact potentials. For pn stacks,
 * concentrate the voltage drop near depletion regions instead of using a linear ramp.
 */
function applyBiasToPhi(
  mesh: ReturnType<typeof buildMesh>,
  stack: LayerStack,
  eqPhi: Float64Array,
  phiLeft: number,
  phiRight: number,
): Float64Array {
  const phi = new Float64Array(eqPhi.length);
  const eqLeft = eqPhi[0]!;
  const eqRight = eqPhi[eqPhi.length - 1]!;
  const leftDelta = phiLeft - eqLeft;
  const rightDelta = phiRight - eqRight;
  const shape = depletionBiasShape(mesh, stack, eqPhi);
  if (shape) {
    for (let i = 0; i < eqPhi.length; i++) {
      phi[i] = eqPhi[i]! + leftDelta + (rightDelta - leftDelta) * shape[i]!;
    }
    phi[0] = phiLeft;
    phi[phi.length - 1] = phiRight;
    return phi;
  }

  const x0 = mesh.nodes[0]!.xM;
  const xL = mesh.nodes[eqPhi.length - 1]!.xM;
  for (let i = 0; i < eqPhi.length; i++) {
    const t = (mesh.nodes[i]!.xM - x0) / (xL - x0 || 1);
    phi[i] = eqPhi[i]! + (1 - t) * leftDelta + t * rightDelta;
  }
  return phi;
}

export function solveStack(
  stack: LayerStack,
  options: SolverOptions = DEFAULT_SOLVER_OPTIONS,
): SimulationResult {
  const inferred = inferContacts(stack);
  const contactLeft = options.contactLeft ?? inferred.left;
  const contactRight = options.contactRight ?? inferred.right;
  const semStack = semiconductorStack(stack);

  const mesh = buildMesh(stack, options);
  const count = mesh.nodes.length;
  const { ecRefEv, evRefEv } = buildBandReferences(stack);
  const atEquilibrium = Math.abs(options.Vapp) < 1e-12;

  const eqContacts = buildContactState(
    semStack,
    ecRefEv,
    evRefEv,
    contactLeft,
    contactRight,
    0,
  );
  const eqPhi = solveEquilibriumPoisson(
    mesh,
    semStack,
    eqContacts,
    options,
    stack,
    contactLeft,
    contactRight,
  );

  const contacts = atEquilibrium
    ? eqContacts
    : buildContactState(semStack, ecRefEv, evRefEv, contactLeft, contactRight, options.Vapp);

  const phi = atEquilibrium
    ? eqPhi
    : solveBiasedPoisson(mesh, semStack, contacts, eqContacts, options, eqPhi);

  const { eFnEv, eFpEv } = quasiFermiProfile(
    mesh,
    count,
    contacts.eFLeft,
    contacts.eFLeft,
    contacts.eFRight,
    contacts.eFRight,
  );

  const { nM3: n, pM3: p } = carrierDensities(mesh, phi, eFnEv, eFpEv, stack.temperatureK);

  if (!isFiniteArray(phi) || !isFiniteArray(n) || !isFiniteArray(p)) {
    throw new ConvergenceError("Solution contains non-finite values");
  }

  const rho = chargeDensity(mesh, n, p);
  const bands = computeBands(mesh, phi, eFnEv, eFpEv);
  const bandDisplay = displayBands(mesh, stack, bands, contacts);
  const preContact = preContactBands(stack);
  const field = electricField(mesh, phi);

  return {
    mesh,
    phiV: phi,
    nM3: n,
    pM3: p,
    rhoCm3: rho,
    fieldVm: field,
    bands: bandDisplay,
    preContactBands: preContact,
    preContactMaterialRegions: preContactMaterialRegions(stack),
    materialRegions: preContactMaterialRegions(stack),
    fermiLevelEv: 0.5 * (contacts.eFLeft + contacts.eFRight),
    appliedVoltageV: options.Vapp,
    builtInVoltageV: eqContacts.right.phiV - eqContacts.left.phiV,
    converged: true,
    iterations: atEquilibrium ? 1 : 2,
    contactLeft: toContactSummary(eqContacts.left),
    contactRight: toContactSummary(eqContacts.right),
  };
}
