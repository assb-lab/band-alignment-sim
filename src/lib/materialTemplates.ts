import type { LayerKind } from "../physics/types.ts";
import type { DopingInputMode, LayerRow } from "./layerForm.ts";

export interface MaterialTemplate {
  id: string;
  source: "built-in" | "user";
  name: string;
  kind: LayerKind;
  workFunctionEv: number;
  epsilonR: number;
  bandGapEv: number;
  electronAffinityEv: number;
  NcCm3: number;
  NvCm3: number;
  niCm3: number | null;
  deltaEcEv: number;
  deltaEvEv: number;
  dopingInputMode?: DopingInputMode;
  fermiLevelVacuumEv?: number;
  NdCm3?: number;
  NaCm3?: number;
}

const DB_NAME = "band-alignment-sim";
const DB_VERSION = 1;
const STORE_NAME = "material-templates";

const semiconductorTemplate = (
  id: string,
  name: string,
  material: Omit<MaterialTemplate, "id" | "source" | "name" | "kind" | "workFunctionEv" | "niCm3"> &
    Partial<Pick<MaterialTemplate, "workFunctionEv" | "niCm3">>,
): MaterialTemplate => ({
  id,
  source: "built-in",
  name,
  kind: "semiconductor",
  workFunctionEv: material.workFunctionEv ?? 4.8,
  niCm3: material.niCm3 ?? null,
  ...material,
});

const dopedSemiconductorTemplates = (
  id: string,
  name: string,
  material: Parameters<typeof semiconductorTemplate>[2],
  doping: { n: number; p: number },
): MaterialTemplate[] => [
  semiconductorTemplate(`${id}-n`, `n-${name}`, {
    ...material,
    dopingInputMode: "direct",
    NdCm3: doping.n,
    NaCm3: 0,
  }),
  semiconductorTemplate(`${id}-p`, `p-${name}`, {
    ...material,
    dopingInputMode: "direct",
    NdCm3: 0,
    NaCm3: doping.p,
  }),
];

const metalTemplate = (id: string, name: string, workFunctionEv: number): MaterialTemplate => ({
  id,
  source: "built-in",
  name,
  kind: "metal",
  workFunctionEv,
  epsilonR: 1,
  bandGapEv: 0,
  electronAffinityEv: 0,
  NcCm3: 0,
  NvCm3: 0,
  niCm3: null,
  deltaEcEv: 0,
  deltaEvEv: 0,
});

export const BUILT_IN_MATERIAL_TEMPLATES: MaterialTemplate[] = [
  ...dopedSemiconductorTemplates(
    "builtin-si",
    "Si",
    {
      epsilonR: 11.7,
      bandGapEv: 1.12,
      electronAffinityEv: 4.05,
      NcCm3: 2.8e19,
      NvCm3: 1.04e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e16, p: 1e16 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-ge",
    "Ge",
    {
      epsilonR: 16,
      bandGapEv: 0.66,
      electronAffinityEv: 4.0,
      NcCm3: 1.04e19,
      NvCm3: 6.0e18,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e16, p: 1e16 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-gaas",
    "GaAs",
    {
      epsilonR: 13.1,
      bandGapEv: 1.42,
      electronAffinityEv: 4.07,
      NcCm3: 4.7e17,
      NvCm3: 8.6e18,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 2e18, p: 5e17 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-algaas",
    "AlGaAs",
    {
      epsilonR: 12.2,
      bandGapEv: 1.8,
      electronAffinityEv: 3.67,
      NcCm3: 4.7e17,
      NvCm3: 8.6e18,
      deltaEcEv: 0.38,
      deltaEvEv: 0,
    },
    { n: 1e16, p: 1e18 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-inp",
    "InP",
    {
      epsilonR: 12.4,
      bandGapEv: 1.35,
      electronAffinityEv: 4.38,
      NcCm3: 5.7e17,
      NvCm3: 1.1e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e18, p: 1e18 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-ingaas",
    "In0.53Ga0.47As",
    {
      epsilonR: 13.9,
      bandGapEv: 0.75,
      electronAffinityEv: 4.5,
      NcCm3: 2.2e17,
      NvCm3: 7.7e18,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e17, p: 1e17 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-inas",
    "InAs",
    {
      epsilonR: 15.15,
      bandGapEv: 0.354,
      electronAffinityEv: 4.9,
      NcCm3: 8.7e16,
      NvCm3: 6.6e18,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e16, p: 1e16 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-gan",
    "GaN",
    {
      epsilonR: 9.5,
      bandGapEv: 3.4,
      electronAffinityEv: 4.1,
      NcCm3: 2.3e18,
      NvCm3: 4.6e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 6e18, p: 6e17 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-algan",
    "AlGaN",
    {
      epsilonR: 9.0,
      bandGapEv: 4.1,
      electronAffinityEv: 3.5,
      NcCm3: 2.3e18,
      NvCm3: 4.6e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e18, p: 1e17 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-4h-sic",
    "4H-SiC",
    {
      epsilonR: 9.7,
      bandGapEv: 3.26,
      electronAffinityEv: 3.7,
      NcCm3: 1.6e19,
      NvCm3: 2.5e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 6e18, p: 1e17 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-zno",
    "ZnO",
    {
      epsilonR: 8.5,
      bandGapEv: 3.3,
      electronAffinityEv: 4.35,
      NcCm3: 2.8e18,
      NvCm3: 1.8e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e17, p: 9e16 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-cdte",
    "CdTe",
    {
      epsilonR: 10.2,
      bandGapEv: 1.5,
      electronAffinityEv: 4.28,
      NcCm3: 8.0e17,
      NvCm3: 1.8e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e17, p: 1e15 },
  ),
  ...dopedSemiconductorTemplates(
    "builtin-mos2",
    "MoS2",
    {
      epsilonR: 7.0,
      bandGapEv: 1.8,
      electronAffinityEv: 4.2,
      NcCm3: 2.0e18,
      NvCm3: 2.0e19,
      deltaEcEv: 0,
      deltaEvEv: 0,
    },
    { n: 1e17, p: 1e17 },
  ),
  metalTemplate("builtin-au", "Au", 4.8),
  metalTemplate("builtin-al", "Al", 4.28),
  metalTemplate("builtin-ti", "Ti", 4.33),
  metalTemplate("builtin-ni", "Ni", 5.15),
  metalTemplate("builtin-pt", "Pt", 5.65),
  metalTemplate("builtin-ag", "Ag", 4.26),
  metalTemplate("builtin-cu", "Cu", 4.65),
  metalTemplate("builtin-ito", "ITO", 4.7),
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function runStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  fallback: T,
): Promise<T> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(fallback);
  }
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = action(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB transaction failed"));
        };
      }),
  );
}

export function listUserMaterialTemplates(): Promise<MaterialTemplate[]> {
  return runStore<MaterialTemplate[]>("readonly", (store) => store.getAll(), []);
}

export function saveUserMaterialTemplate(template: MaterialTemplate): Promise<MaterialTemplate> {
  return runStore<IDBValidKey>("readwrite", (store) => store.put(template), template.id).then(
    () => template,
  );
}

export function deleteUserMaterialTemplate(id: string): Promise<void> {
  return runStore<undefined>("readwrite", (store) => store.delete(id), undefined).then(
    () => undefined,
  );
}

function uniqueUserTemplateId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `user-${Date.now()}-${random}`;
}

export function rowToMaterialTemplate(row: LayerRow, name = row.label): MaterialTemplate {
  return {
    id: uniqueUserTemplateId(),
    source: "user",
    name,
    kind: row.kind,
    workFunctionEv: row.workFunctionEv,
    epsilonR: row.epsilonR,
    bandGapEv: row.bandGapEv,
    electronAffinityEv: row.electronAffinityEv,
    NcCm3: row.NcCm3,
    NvCm3: row.NvCm3,
    niCm3: row.niCm3,
    deltaEcEv: row.deltaEcEv,
    deltaEvEv: row.deltaEvEv,
    dopingInputMode: row.dopingInputMode,
    fermiLevelVacuumEv: row.fermiLevelVacuumEv,
    NdCm3: row.NdCm3,
    NaCm3: row.NaCm3,
  };
}

const MATERIAL_NUMBER_KEYS = [
  "workFunctionEv",
  "epsilonR",
  "bandGapEv",
  "electronAffinityEv",
  "NcCm3",
  "NvCm3",
  "deltaEcEv",
  "deltaEvEv",
] as const satisfies readonly (keyof MaterialTemplate)[];

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-9;
}

function hasSavedDoping(template: MaterialTemplate): boolean {
  return (
    template.dopingInputMode !== undefined ||
    template.fermiLevelVacuumEv !== undefined ||
    template.NdCm3 !== undefined ||
    template.NaCm3 !== undefined
  );
}

export function isSameMaterialTemplate(
  a: MaterialTemplate,
  b: MaterialTemplate,
): boolean {
  if (a.kind !== b.kind || a.niCm3 !== b.niCm3) return false;
  if (!MATERIAL_NUMBER_KEYS.every((key) => nearlyEqual(a[key], b[key]))) return false;
  if (a.kind === "metal") return true;

  const aHasDoping = hasSavedDoping(a);
  const bHasDoping = hasSavedDoping(b);
  if (aHasDoping !== bHasDoping) return false;
  if (!aHasDoping && !bHasDoping) return true;

  return (
    a.dopingInputMode === b.dopingInputMode &&
    nearlyEqual(a.fermiLevelVacuumEv ?? 0, b.fermiLevelVacuumEv ?? 0) &&
    nearlyEqual(a.NdCm3 ?? 0, b.NdCm3 ?? 0) &&
    nearlyEqual(a.NaCm3 ?? 0, b.NaCm3 ?? 0)
  );
}

export function findDuplicateMaterialTemplate(
  template: MaterialTemplate,
  templates: MaterialTemplate[],
): MaterialTemplate | undefined {
  return templates.find((item) => isSameMaterialTemplate(item, template));
}

export function applyMaterialTemplate(row: LayerRow, template: MaterialTemplate): LayerRow {
  return {
    ...row,
    kind: template.kind,
    label: template.name,
    workFunctionEv: template.workFunctionEv,
    epsilonR: template.epsilonR,
    bandGapEv: template.bandGapEv,
    electronAffinityEv: template.electronAffinityEv,
    NcCm3: template.NcCm3,
    NvCm3: template.NvCm3,
    niCm3: template.niCm3,
    deltaEcEv: template.deltaEcEv,
    deltaEvEv: template.deltaEvEv,
    dopingInputMode: template.dopingInputMode ?? row.dopingInputMode,
    fermiLevelVacuumEv:
      template.fermiLevelVacuumEv ??
      (template.kind === "metal" ? -template.workFunctionEv : row.fermiLevelVacuumEv),
    NdCm3: template.NdCm3 ?? row.NdCm3,
    NaCm3: template.NaCm3 ?? row.NaCm3,
  };
}
