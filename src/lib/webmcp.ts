import type { UseSimulationReturn } from "../hooks/useSimulation.ts";
import {
  isLayerRowEnabled,
  layerToRow,
  rowToLayer,
  withDopingFromFermi,
  withFermiFromDoping,
} from "./layerForm.ts";
import { validateStack } from "../physics/stackContacts.ts";
import type { SimulationResult } from "../physics/types.ts";
import { INTERFACE_PRESETS } from "../presets/interfaces.ts";

type Schema = Record<string, unknown>;
export interface ModelTool {
  name: string;
  description: string;
  inputSchema: Schema;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown, options?: { signal: AbortSignal }) => Promise<unknown>;
}

const number = (minimum: number, maximum: number): Schema => ({ type: "number", minimum, maximum });
const positive = (maximum: number): Schema => ({ type: "number", exclusiveMinimum: 0, maximum });
const integer = (minimum: number, maximum: number): Schema => ({
  type: "integer",
  minimum,
  maximum,
});
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const rowProperties: Record<string, Schema> = {
  id: { type: "string", minLength: 1, maxLength: 100 },
  enabled: { type: "boolean" },
  kind: { type: "string", enum: ["semiconductor", "metal"] },
  label: { type: "string", minLength: 1, maxLength: 200 },
  dopingInputMode: {
    type: "string",
    enum: ["fermi", "direct"],
    description: "Selects whether the vacuum Fermi level or Nd/Na determines doping.",
  },
  thicknessNm: number(0, 1e6),
  workFunctionEv: number(0, 100),
  epsilonR: positive(1e6),
  bandGapEv: number(0, 100),
  electronAffinityEv: number(-100, 100),
  NcCm3: number(0, 1e30),
  NvCm3: number(0, 1e30),
  niCm3: { anyOf: [positive(1e30), { type: "null" }] },
  fermiLevelVacuumEv: number(-100, 100),
  NdCm3: number(0, 1e30),
  NaCm3: number(0, 1e30),
  deltaEcEv: number(-100, 100),
  deltaEvEv: number(-100, 100),
};
const settingsProperties: Record<string, Schema> = {
  temperatureK: number(1, 5000),
  Vapp: number(-100, 100),
  electrodeMode: { type: "string", enum: ["shorted", "open", "bias"] },
  nodesPerNm: number(0.01, 100),
  tol: number(1e-12, 0.1),
  maxGummelIter: integer(1, 1000),
  maxNewtonIter: integer(1, 5000),
  maxRelativeResidual: positive(100),
};
const configureSchema = object({
  preset: {
    type: "string",
    enum: INTERFACE_PRESETS.map((p) => p.name),
    description: "Replaces rows and resets temperature and electrode mode to the preset defaults.",
  },
  rows: {
    type: "array",
    minItems: 1,
    maxItems: 32,
    description:
      "Complete replacement in UI units. Copy rows from get_simulation_state and edit them. Cannot be combined with preset.",
    items: object(
      rowProperties,
      Object.keys(rowProperties).filter((k) => k !== "id" && k !== "enabled"),
    ),
  },
  ...settingsProperties,
});
const settingsSchema = object(
  { ...settingsProperties, rows: (configureSchema.properties as Record<string, Schema>).rows! },
  ["rows", ...Object.keys(settingsProperties)],
);

// Browsers expose schemas to agents but do not enforce them on execute().
function validate(value: unknown, schema: Schema, path = "input"): void {
  if (schema.anyOf) {
    for (const option of schema.anyOf as Schema[]) {
      try {
        validate(value, option, path);
        return;
      } catch {
        /* try the next type */
      }
    }
    throw new Error(`${path} must be null or a positive finite number.`);
  }
  if (schema.enum && !(schema.enum as unknown[]).includes(value))
    throw new Error(`${path} must be one of ${(schema.enum as unknown[]).join(", ")}.`);
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`${path} must be an object.`);
    const data = value as Record<string, unknown>;
    const properties = schema.properties as Record<string, Schema>;
    for (const key of schema.required as string[])
      if (!Object.hasOwn(data, key)) throw new Error(`${path}.${key} is required.`);
    for (const key of Object.keys(data)) {
      if (!Object.hasOwn(properties, key)) throw new Error(`Unknown field ${path}.${key}.`);
      validate(data[key], properties[key]!, `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems as number) ||
      value.length > (schema.maxItems as number)
    )
      throw new Error(`${path} has an invalid number of items.`);
    value.forEach((item, i) => validate(item, schema.items as Schema, `${path}[${i}]`));
  } else if (schema.type === "number" || schema.type === "integer") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (schema.type === "integer" && !Number.isInteger(value)) ||
      (schema.minimum !== undefined && value < (schema.minimum as number)) ||
      (schema.exclusiveMinimum !== undefined && value <= (schema.exclusiveMinimum as number)) ||
      value > (schema.maximum as number)
    )
      throw new Error(`${path} is outside the supported numeric range.`);
  } else if (schema.type === "string") {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > ((schema.maxLength as number | undefined) ?? Infinity)
    )
      throw new Error(`${path} must be a nonempty string of the supported length.`);
  } else if (schema.type === "boolean" && typeof value !== "boolean")
    throw new Error(`${path} must be a boolean.`);
  else if (schema.type === "null" && value !== null) throw new Error(`${path} must be null.`);
}

export type SimulationSettings = Pick<
  UseSimulationReturn,
  | "rows"
  | "temperatureK"
  | "Vapp"
  | "electrodeMode"
  | "nodesPerNm"
  | "tol"
  | "maxGummelIter"
  | "maxNewtonIter"
  | "maxRelativeResidual"
>;

export function simulationSettings(sim: UseSimulationReturn): SimulationSettings {
  return Object.fromEntries(
    ["rows", ...Object.keys(settingsProperties)].map((k) => [
      k,
      sim[k as keyof SimulationSettings],
    ]),
  ) as SimulationSettings;
}

function summary(result: SimulationResult) {
  return {
    converged: result.converged,
    iterations: result.iterations,
    builtInVoltageV: result.builtInVoltageV,
    appliedVoltageV: result.appliedVoltageV,
    fermiLevelEv: result.fermiLevelEv,
    nodeCount: result.mesh.nodes.length,
    contactLeft: result.contactLeft,
    contactRight: result.contactRight,
  };
}

function sampleIndices(length: number, maxPoints: number): number[] {
  const count = Math.min(length, maxPoints);
  return Array.from({ length: count }, (_, i) =>
    count === 1 ? 0 : Math.round((i * (length - 1)) / (count - 1)),
  );
}

function profiles(result: SimulationResult, maxPoints: number) {
  const finite = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : null);
  return {
    ...summary(result),
    sampling: {
      maxPoints,
      method: "uniform-index, includes endpoints; narrow features may be omitted",
    },
    units: {
      xNm: "nm",
      phiV: "V",
      nCm3: "cm^-3",
      pCm3: "cm^-3",
      rhoCPerM3: "C/m^3",
      fieldVPerM: "V/m",
      ecEv: "eV",
      evEv: "eV",
      efnEv: "eV",
      efpEv: "eV",
    },
    mesh: sampleIndices(result.mesh.nodes.length, maxPoints).map((i) => ({
      xNm: result.mesh.nodes[i]!.xM * 1e9,
      layerIndex: result.mesh.nodes[i]!.layerIndex,
      phiV: finite(result.phiV[i]),
      nCm3: finite(result.nM3[i]! / 1e6),
      pCm3: finite(result.pM3[i]! / 1e6),
      rhoCPerM3: finite(result.rhoCm3[i]),
      fieldVPerM: finite(result.fieldVm[i]),
    })),
    bands: sampleIndices(result.bands.ecEv.length, maxPoints).map((i) => ({
      xNm: finite((result.bands.xM?.[i] ?? result.mesh.nodes[i]?.xM ?? NaN) * 1e9),
      kind: result.bands.layerKind?.[i] ?? "semiconductor",
      ecEv: finite(result.bands.ecEv[i]),
      evEv: finite(result.bands.evEv[i]),
      efnEv: finite(result.bands.efnEv[i]),
      efpEv: finite(result.bands.efpEv[i]),
    })),
    materialRegions: result.materialRegions.map((r) => ({
      label: r.label,
      layerIndex: r.layerIndex,
      xStartNm: r.xStartM * 1e9,
      xEndNm: r.xEndM * 1e9,
    })),
  };
}

export function createSimulationTools(
  getSim: () => UseSimulationReturn,
  apply: (settings: SimulationSettings) => void,
  commit: (update: () => void) => void,
): ModelTool[] {
  const tool = (
    name: string,
    description: string,
    inputSchema: Schema,
    readOnlyHint: boolean,
    execute: (input: Record<string, unknown>, signal?: AbortSignal) => unknown | Promise<unknown>,
  ): ModelTool => ({
    name,
    description,
    inputSchema,
    annotations: { readOnlyHint },
    execute: async (input, options) => {
      const signal = options?.signal;
      signal?.throwIfAborted();
      try {
        validate(input, inputSchema);
        return await execute(input as Record<string, unknown>, signal);
      } catch (error) {
        signal?.throwIfAborted();
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  return [
    tool(
      "list_presets",
      "List built-in interface stacks available to load.",
      object({}),
      true,
      () => ({
        presets: INTERFACE_PRESETS.map((p) => ({
          name: p.name,
          layers: p.stack().layers.map((l) => l.label),
        })),
      }),
    ),
    tool(
      "get_simulation_state",
      "Read current UI settings and calculation status. Layer values use nm, eV and cm^-3.",
      object({}),
      true,
      () => {
        const sim = getSim();
        return {
          ...simulationSettings(sim),
          running: sim.running,
          error: sim.error,
          resultIsCurrent: sim.resultIsCurrent,
          result: sim.resultIsCurrent && sim.result ? summary(sim.result) : null,
        };
      },
    ),
    tool(
      "configure_simulation",
      "Change the visible stack and calculation settings. Validates the complete configuration before applying it. Live mode may recalculate automatically.",
      configureSchema,
      false,
      (input) => {
        if (input.preset !== undefined && input.rows !== undefined)
          throw new Error("Specify preset or rows, not both.");
        const current = simulationSettings(getSim());
        const { preset, ...changes } = input;
        const next = { ...current, ...changes } as SimulationSettings;
        if (preset !== undefined) {
          const stack = INTERFACE_PRESETS.find((p) => p.name === preset)!.stack();
          next.rows = stack.layers.map((l, i) => layerToRow(l, `webmcp-${i}`, stack.temperatureK));
          next.temperatureK = (input.temperatureK as number | undefined) ?? stack.temperatureK;
          next.electrodeMode =
            (input.electrodeMode as SimulationSettings["electrodeMode"] | undefined) ?? "shorted";
          next.Vapp = (input.Vapp as number | undefined) ?? 0;
        }
        next.rows = next.rows.map((row, i) => ({ ...row, id: row.id ?? `webmcp-${i}` }));
        validate(next, settingsSchema);
        if (new Set(next.rows.map((r) => r.id)).size !== next.rows.length)
          throw new Error("Layer ids must be unique.");
        const active = next.rows.filter(isLayerRowEnabled);
        for (const row of active) {
          if (
            row.kind === "semiconductor" &&
            (row.thicknessNm <= 0 ||
              row.bandGapEv <= 0 ||
              (row.niCm3 === null && (row.NcCm3 <= 0 || row.NvCm3 <= 0)))
          ) {
            throw new Error(
              "Semiconductors require positive thicknessNm, bandGapEv and positive NcCm3/NvCm3 (or niCm3).",
            );
          }
        }
        next.rows = next.rows.map((row) =>
          row.dopingInputMode === "direct"
            ? withFermiFromDoping(row, next.temperatureK)
            : withDopingFromFermi(row, next.temperatureK),
        );
        validate(next, settingsSchema);
        validateStack({
          temperatureK: next.temperatureK,
          layers: active.map((r) => rowToLayer(r, next.temperatureK)),
        });
        const estimatedNodes = active
          .filter((r) => r.kind === "semiconductor")
          .reduce(
            (sum, r) => sum + Math.max(40, Math.ceil(r.thicknessNm * next.nodesPerNm) + 1),
            0,
          );
        if (estimatedNodes > 20000)
          throw new Error("Mesh exceeds 20000 nodes. Reduce thickness or nodesPerNm.");
        apply(next);
        return { ...simulationSettings(getSim()), resultIsCurrent: false };
      },
    ),
    tool(
      "run_simulation",
      "Calculate the current visible configuration using the existing solver and update the plots. Returns convergence and voltage summary. Bias uses the app's experimental drift-diffusion approximation.",
      object({}),
      false,
      async (_, signal) => {
        const before = JSON.stringify(simulationSettings(getSim()));
        const result = await getSim().runForAgent(signal, commit);
        if (before !== JSON.stringify(simulationSettings(getSim())))
          throw new Error(
            "Settings changed during calculation. Run again with the current settings.",
          );
        return summary(result);
      },
    ),
    tool(
      "get_simulation_results",
      "Read sampled band, potential, field, charge and carrier profiles for the current settings. Run the simulation first if the result is missing or stale. Metal band edges are null.",
      object({ maxPoints: { ...integer(2, 1000), default: 200 } }),
      true,
      (input) => {
        const sim = getSim();
        if (sim.running || !sim.resultIsCurrent || !sim.result)
          throw new Error(
            "No completed result for the current settings. Call run_simulation first.",
          );
        return profiles(sim.result, (input.maxPoints as number | undefined) ?? 200);
      },
    ),
  ];
}
