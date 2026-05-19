import type { ContactBoundary, Layer, LayerStack } from "./types.ts";
import { OHMIC_CONTACT } from "./types.ts";

export class StackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StackValidationError";
  }
}

export function isMetalLayer(layer: Layer): boolean {
  return layer.kind === "metal";
}

export function isSemiconductorLayer(layer: Layer): boolean {
  return layer.kind !== "metal";
}

/** Semiconductor layers only, in stack order (for mesh and Poisson). */
export function semiconductorLayers(stack: LayerStack): Layer[] {
  return stack.layers.filter(isSemiconductorLayer);
}

export interface InferredContacts {
  left: ContactBoundary;
  right: ContactBoundary;
  /** Index in full stack.layers of first semiconductor */
  firstSemIndex: number;
  /** Index in full stack.layers of last semiconductor */
  lastSemIndex: number;
}

function schottkyFromMetal(layer: Layer): ContactBoundary {
  const phiM = layer.workFunctionEv;
  if (phiM === undefined || !Number.isFinite(phiM)) {
    throw new StackValidationError(`Metal layer "${layer.label}" requires workFunctionEv (Φ_m)`);
  }
  return { kind: "schottky", workFunctionEv: phiM };
}

/**
 * Metal may only appear as contiguous blocks at the start and/or end of the stack.
 */
export function validateStack(stack: LayerStack): void {
  if (stack.layers.length === 0) {
    throw new StackValidationError("Stack must contain at least one layer");
  }

  const sem = semiconductorLayers(stack);
  if (sem.length === 0) {
    throw new StackValidationError("Stack must contain at least one semiconductor layer");
  }

  let inLeadingMetal = true;
  let seenSemiconductor = false;
  let inTrailingMetal = false;

  for (const layer of stack.layers) {
    if (isMetalLayer(layer)) {
      if (seenSemiconductor) {
        inTrailingMetal = true;
      } else if (!inLeadingMetal) {
        throw new StackValidationError("Metal layers must be contiguous at stack ends only");
      }
      if (inTrailingMetal && !seenSemiconductor) {
        throw new StackValidationError("Invalid metal placement in stack");
      }
    } else {
      seenSemiconductor = true;
      if (inTrailingMetal) {
        throw new StackValidationError(
          "Metal cannot appear between semiconductor layers (only at stack ends)",
        );
      }
      inLeadingMetal = false;
    }
  }
}

/** Derive left/right contacts from metal rows at stack ends. */
export function inferContacts(stack: LayerStack): InferredContacts {
  validateStack(stack);

  let firstSemIndex = -1;
  let lastSemIndex = -1;
  for (let i = 0; i < stack.layers.length; i++) {
    if (isSemiconductorLayer(stack.layers[i]!)) {
      if (firstSemIndex < 0) firstSemIndex = i;
      lastSemIndex = i;
    }
  }

  let left: ContactBoundary = OHMIC_CONTACT;
  if (firstSemIndex > 0) {
    const metal = stack.layers[firstSemIndex - 1]!;
    left = schottkyFromMetal(metal);
  }

  let right: ContactBoundary = OHMIC_CONTACT;
  if (lastSemIndex >= 0 && lastSemIndex < stack.layers.length - 1) {
    const metal = stack.layers[lastSemIndex + 1]!;
    right = schottkyFromMetal(metal);
  }

  return { left, right, firstSemIndex, lastSemIndex };
}

/** Full stack with only semiconductor layers (same temperature). */
export function semiconductorStack(stack: LayerStack): LayerStack {
  return { temperatureK: stack.temperatureK, layers: semiconductorLayers(stack) };
}
