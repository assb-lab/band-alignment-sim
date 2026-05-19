import { useState } from "react";
import {
  type DopingInputMode,
  type LayerRow,
  withDopingFromFermi,
  withFermiFromDoping,
} from "../lib/layerForm.ts";
import type { MaterialTemplate } from "../lib/materialTemplates.ts";
import { numericInputAttrs } from "./numericInputAttrs.ts";
import { ScientificNumberInput } from "./ScientificNumberInput.tsx";

interface MaterialLibraryModalProps {
  builtInTemplates: MaterialTemplate[];
  userTemplates: MaterialTemplate[];
  onClose: () => void;
  onSave: (template: MaterialTemplate) => Promise<string | null>;
  onDelete: (id: string) => Promise<void>;
}

const LIBRARY_TEMPERATURE_K = 300;

function newTemplate(): MaterialTemplate {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id: `user-${Date.now()}-${random}`,
    source: "user",
    name: "New material",
    kind: "semiconductor",
    workFunctionEv: 4.8,
    epsilonR: 10,
    electronAffinityEv: 4,
    bandGapEv: 1,
    NcCm3: 1e18,
    NvCm3: 1e19,
    niCm3: null,
    deltaEcEv: 0,
    deltaEvEv: 0,
    dopingInputMode: "direct",
    fermiLevelVacuumEv: -4.8,
    NdCm3: 1e16,
    NaCm3: 0,
  };
}

function templateToRow(template: MaterialTemplate): LayerRow {
  return {
    id: template.id,
    kind: template.kind,
    label: template.name,
    dopingInputMode: template.dopingInputMode ?? "fermi",
    thicknessNm: 100,
    workFunctionEv: template.workFunctionEv,
    epsilonR: template.epsilonR,
    bandGapEv: template.bandGapEv,
    electronAffinityEv: template.electronAffinityEv,
    NcCm3: template.NcCm3,
    NvCm3: template.NvCm3,
    niCm3: template.niCm3,
    fermiLevelVacuumEv: template.fermiLevelVacuumEv ?? -template.workFunctionEv,
    NdCm3: template.NdCm3 ?? 0,
    NaCm3: template.NaCm3 ?? 0,
    deltaEcEv: template.deltaEcEv,
    deltaEvEv: template.deltaEvEv,
  };
}

function rowDopingToTemplate(template: MaterialTemplate, row: LayerRow): MaterialTemplate {
  return {
    ...template,
    dopingInputMode: row.dopingInputMode,
    fermiLevelVacuumEv: row.fermiLevelVacuumEv,
    NdCm3: row.NdCm3,
    NaCm3: row.NaCm3,
  };
}

function normalizeSemiconductorDoping(template: MaterialTemplate): MaterialTemplate {
  if (template.kind === "metal") return template;
  const row = templateToRow(template);
  const doped =
    row.dopingInputMode === "direct"
      ? withFermiFromDoping(row, LIBRARY_TEMPERATURE_K)
      : withDopingFromFermi(row, LIBRARY_TEMPERATURE_K);
  return rowDopingToTemplate(template, doped);
}

function updateNumeric(
  template: MaterialTemplate,
  key: keyof Pick<
    MaterialTemplate,
    "workFunctionEv" | "epsilonR" | "electronAffinityEv" | "bandGapEv" | "NcCm3" | "NvCm3"
  >,
  value: number,
): MaterialTemplate {
  if (!Number.isFinite(value)) return template;
  if (template.kind === "metal" && key === "workFunctionEv") {
    return { ...template, workFunctionEv: value, fermiLevelVacuumEv: -value };
  }
  if (key === "electronAffinityEv") {
    const ip = template.electronAffinityEv + template.bandGapEv;
    return normalizeSemiconductorDoping({
      ...template,
      electronAffinityEv: value,
      bandGapEv: Math.max(0, ip - value),
    });
  }
  return normalizeSemiconductorDoping({ ...template, [key]: value });
}

function updateIp(template: MaterialTemplate, ip: number): MaterialTemplate {
  if (!Number.isFinite(ip)) return template;
  return normalizeSemiconductorDoping({
    ...template,
    bandGapEv: Math.max(0, ip - template.electronAffinityEv),
  });
}

function updateDopingMode(template: MaterialTemplate, mode: DopingInputMode): MaterialTemplate {
  if (template.kind === "metal") return template;
  return normalizeSemiconductorDoping({ ...template, dopingInputMode: mode });
}

function updatePhi(template: MaterialTemplate, phiEv: number): MaterialTemplate {
  if (!Number.isFinite(phiEv)) return template;
  return normalizeSemiconductorDoping({
    ...template,
    dopingInputMode: "fermi",
    fermiLevelVacuumEv: -phiEv,
  });
}

function updateDopantDensity(
  template: MaterialTemplate,
  key: "NdCm3" | "NaCm3",
  value: number,
): MaterialTemplate {
  if (!Number.isFinite(value)) return template;
  return normalizeSemiconductorDoping({
    ...template,
    dopingInputMode: "direct",
    [key]: Math.max(0, value),
  });
}

function formatDensity(value: number | undefined): string {
  if (!Number.isFinite(value) || !value || value <= 0) return "0";
  return value.toExponential(2);
}

function MaterialRow({
  template,
  readOnly,
  onChange,
  onSave,
  onDelete,
  saveLabel,
}: {
  template: MaterialTemplate;
  readOnly?: boolean;
  onChange?: (template: MaterialTemplate) => void;
  onSave?: () => void;
  onDelete?: () => void;
  saveLabel: string;
}) {
  const ip = template.electronAffinityEv + template.bandGapEv;
  const normalized = normalizeSemiconductorDoping(template);
  const dopingMode = normalized.dopingInputMode ?? "fermi";
  const phiEv = -(normalized.fermiLevelVacuumEv ?? -normalized.workFunctionEv);
  const inputClass =
    "w-full min-w-[4.5rem] rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-950";
  const valueClass = "block min-w-[4.5rem] px-1.5 py-1 text-slate-700";

  return (
    <tr className="border-t border-slate-200">
      <td className="px-1 py-1">
        {readOnly ? (
          <span className={valueClass}>{template.name}</span>
        ) : (
          <input
            className={inputClass}
            value={template.name}
            onChange={(event) => onChange?.({ ...template, name: event.target.value })}
          />
        )}
      </td>
      <td className="px-1 py-1">
        {readOnly ? (
          <span className={valueClass}>{template.kind}</span>
        ) : (
          <select
            className={inputClass}
            value={template.kind}
            onChange={(event) =>
              onChange?.(
                normalizeSemiconductorDoping({
                  ...template,
                  kind: event.target.value as MaterialTemplate["kind"],
                  fermiLevelVacuumEv:
                    event.target.value === "metal"
                      ? -template.workFunctionEv
                      : template.fermiLevelVacuumEv,
                }),
              )
            }
          >
            <option value="semiconductor">Semiconductor</option>
            <option value="metal">Metal</option>
          </select>
        )}
      </td>
      {template.kind === "metal" ? (
        <>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{template.workFunctionEv.toFixed(2)}</span>
            ) : (
              <input
                className={inputClass}
                type="number"
                {...numericInputAttrs}
                step="0.01"
                value={template.workFunctionEv}
                onChange={(event) =>
                  onChange?.(updateNumeric(template, "workFunctionEv", Number(event.target.value)))
                }
              />
            )}
          </td>
          {Array.from({ length: 10 }).map((_, index) => (
            <td key={index} className="px-1 py-1 text-slate-400">
              -
            </td>
          ))}
        </>
      ) : (
        <>
          <td className="px-1 py-1 text-slate-400">-</td>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{template.epsilonR}</span>
            ) : (
              <input
                className={inputClass}
                type="number"
                {...numericInputAttrs}
                step="0.1"
                value={template.epsilonR}
                onChange={(event) =>
                  onChange?.(updateNumeric(template, "epsilonR", Number(event.target.value)))
                }
              />
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{template.electronAffinityEv.toFixed(2)}</span>
            ) : (
              <input
                className={inputClass}
                type="number"
                {...numericInputAttrs}
                step="0.01"
                value={template.electronAffinityEv}
                onChange={(event) =>
                  onChange?.(
                    updateNumeric(template, "electronAffinityEv", Number(event.target.value)),
                  )
                }
              />
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{ip.toFixed(2)}</span>
            ) : (
              <input
                className={inputClass}
                type="number"
                {...numericInputAttrs}
                step="0.01"
                value={ip}
                onChange={(event) => onChange?.(updateIp(template, Number(event.target.value)))}
              />
            )}
          </td>
          <td className="px-1 py-1">
            <span className={valueClass}>{template.bandGapEv.toFixed(3)}</span>
          </td>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{formatDensity(template.NcCm3)}</span>
            ) : (
              <ScientificNumberInput
                className={inputClass}
                value={template.NcCm3}
                onChange={(value) => onChange?.(updateNumeric(template, "NcCm3", value))}
              />
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{formatDensity(template.NvCm3)}</span>
            ) : (
              <ScientificNumberInput
                className={inputClass}
                value={template.NvCm3}
                onChange={(value) => onChange?.(updateNumeric(template, "NvCm3", value))}
              />
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly ? (
              <span className={valueClass}>{dopingMode === "direct" ? "Nd/Na" : "Φ"}</span>
            ) : (
              <select
                className={inputClass}
                value={dopingMode}
                onChange={(event) =>
                  onChange?.(updateDopingMode(template, event.target.value as DopingInputMode))
                }
              >
                <option value="fermi">Φ</option>
                <option value="direct">Nd/Na</option>
              </select>
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly || dopingMode === "direct" ? (
              <span className={valueClass}>{phiEv.toFixed(3)}</span>
            ) : (
              <input
                className={inputClass}
                type="number"
                {...numericInputAttrs}
                step="0.01"
                value={phiEv}
                onChange={(event) => onChange?.(updatePhi(template, Number(event.target.value)))}
              />
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly || dopingMode === "fermi" ? (
              <span className={valueClass}>{formatDensity(normalized.NdCm3)}</span>
            ) : (
              <ScientificNumberInput
                className={inputClass}
                value={normalized.NdCm3 ?? 0}
                onChange={(value) => onChange?.(updateDopantDensity(template, "NdCm3", value))}
              />
            )}
          </td>
          <td className="px-1 py-1">
            {readOnly || dopingMode === "fermi" ? (
              <span className={valueClass}>{formatDensity(normalized.NaCm3)}</span>
            ) : (
              <ScientificNumberInput
                className={inputClass}
                value={normalized.NaCm3 ?? 0}
                onChange={(value) => onChange?.(updateDopantDensity(template, "NaCm3", value))}
              />
            )}
          </td>
        </>
      )}
      <td className="px-1 py-1">
        {readOnly ? (
          <span className="text-slate-400">Built-in</span>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={`${saveLabel} ${template.name}`}
              className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
              onClick={onSave}
            >
              {saveLabel}
            </button>
            {onDelete && (
              <button
                type="button"
                aria-label={`Delete ${template.name}`}
                className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function MaterialLibraryModal({
  builtInTemplates,
  userTemplates,
  onClose,
  onSave,
  onDelete,
}: MaterialLibraryModalProps) {
  const [newDraft, setNewDraft] = useState<MaterialTemplate>(() => newTemplate());
  const [drafts, setDrafts] = useState<Record<string, MaterialTemplate>>({});
  const [error, setError] = useState<string | null>(null);
  const userDraft = (template: MaterialTemplate) => drafts[template.id] ?? template;

  const save = (template: MaterialTemplate, resetNew = false) => {
    setError(null);
    onSave(normalizeSemiconductorDoping(template)).then((message) => {
      if (message) {
        setError(message);
        return;
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[template.id];
        return next;
      });
      if (resetNew) setNewDraft(newTemplate());
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-library-title"
        className="flex max-h-[86vh] w-full max-w-6xl flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="material-library-title" className="text-base font-semibold text-slate-950">
            Materials
          </h2>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Name</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Type</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Φ_m [eV]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">εr</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">EA [eV]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">IP [eV]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Eg [eV]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Nc [cm⁻³]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Nv [cm⁻³]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Doping</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Φ [eV]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Nd [cm⁻³]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Na [cm⁻³]</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              <MaterialRow
                template={newDraft}
                onChange={setNewDraft}
                onSave={() => save(newDraft, true)}
                saveLabel="Create"
              />
              {userTemplates.map((template) => (
                <MaterialRow
                  key={template.id}
                  template={userDraft(template)}
                  onChange={(next) => setDrafts((current) => ({ ...current, [template.id]: next }))}
                  onSave={() => save(userDraft(template))}
                  onDelete={() => {
                    setError(null);
                    onDelete(template.id);
                  }}
                  saveLabel="Save"
                />
              ))}
              {builtInTemplates.map((template) => (
                <MaterialRow key={template.id} template={template} readOnly saveLabel="Save" />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
