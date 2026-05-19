import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LayerRow } from "../lib/layerForm.ts";
import {
  createSemiconductorRow,
  type DopingInputMode,
  withDopingFromFermi,
  withFermiFromDoping,
} from "../lib/layerForm.ts";
import type { MaterialTemplate } from "../lib/materialTemplates.ts";
import { numericInputAttrs } from "./numericInputAttrs.ts";
import { ScientificNumberInput } from "./ScientificNumberInput.tsx";

interface LayerTableProps {
  rows: LayerRow[];
  onChange: (rows: LayerRow[]) => void;
  materialTemplates?: MaterialTemplate[];
  onApplyMaterialTemplate?: (rowId: string, templateId: string) => void;
  onSaveMaterialTemplate?: (rowId: string) => void;
  temperatureK?: number;
}

type SemField = keyof Pick<
  LayerRow,
  | "label"
  | "thicknessNm"
  | "epsilonR"
  | "bandGapEv"
  | "electronAffinityEv"
  | "NcCm3"
  | "NvCm3"
  | "NdCm3"
  | "NaCm3"
  | "fermiLevelVacuumEv"
>;
type TableField = SemField | "ionizationPotentialEv";

const DENSITY_FIELDS = new Set<SemField>(["NcCm3", "NvCm3", "NdCm3", "NaCm3"]);
const READONLY_FIELDS = new Set<TableField>(["bandGapEv"]);

const inputClass =
  "w-full min-w-[4.5rem] rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-950";

const COMMON_FIELDS: { key: TableField; label: string; step?: string }[] = [
  { key: "label", label: "Material" },
  { key: "thicknessNm", label: "t [nm]", step: "1" },
  { key: "epsilonR", label: "εr", step: "0.1" },
  { key: "electronAffinityEv", label: "EA [eV]", step: "0.01" },
  { key: "ionizationPotentialEv", label: "IP [eV]", step: "0.01" },
  { key: "bandGapEv", label: "Eg [eV]", step: "0.01" },
  { key: "NcCm3", label: "Nc [cm⁻³]" },
  { key: "NvCm3", label: "Nv [cm⁻³]" },
];

const PHI_FIELD = { key: "fermiLevelVacuumEv", label: "Φ [eV]", step: "0.01" } as const;
const TEMPLATE_BUTTON_CLASS =
  "flex w-full min-w-[5.75rem] max-w-[7rem] items-center justify-between rounded border border-slate-300 bg-white px-1.5 py-1 text-left text-slate-950 hover:bg-slate-50";

interface MaterialTemplateSelectProps {
  rowId: string;
  templates: MaterialTemplate[];
  onApply?: (rowId: string, templateId: string) => void;
}

function MaterialTemplateSelect({
  rowId,
  templates,
  onApply,
}: MaterialTemplateSelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 160 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const builtInTemplates = templates.filter((template) => template.source === "built-in");
  const userTemplates = templates.filter((template) => template.source === "user");

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        left: rect.left,
        top: rect.bottom + 4,
        width: Math.max(rect.width, 160),
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const applyTemplate = (templateId: string) => {
    onApply?.(rowId, templateId);
    setOpen(false);
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed z-[60] max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-900 shadow-2xl"
          style={{ left: position.left, top: position.top, width: position.width }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            <span className="w-4 text-slate-900">✓</span>
            <span>Apply...</span>
          </button>
          {builtInTemplates.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs font-medium text-slate-400">Built-in</div>
              {builtInTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="option"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
                  onClick={() => applyTemplate(template.id)}
                >
                  <span className="w-4" />
                  <span>{template.name}</span>
                </button>
              ))}
            </>
          )}
          {userTemplates.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs font-medium text-slate-400">User</div>
              {userTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="option"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
                  onClick={() => applyTemplate(template.id)}
                >
                  <span className="w-4" />
                  <span>{template.name}</span>
                </button>
              ))}
            </>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={TEMPLATE_BUTTON_CLASS}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Apply...</span>
        <span className="text-xs text-slate-500">⌄</span>
      </button>
      {menu}
    </>
  );
}

function updateRow(
  rows: LayerRow[],
  id: string,
  patch: Partial<LayerRow>,
): LayerRow[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

function updateSemField(
  rows: LayerRow[],
  id: string,
  key: TableField,
  raw: string,
  temperatureK: number,
): LayerRow[] {
  return rows.map((row) => {
    if (row.id !== id) return row;
    if (key === "label") return { ...row, label: raw };
    const num = Number(raw);
    let next: LayerRow;
    if (key === "ionizationPotentialEv") {
      const ip = Number.isFinite(num) ? num : row.electronAffinityEv;
      next = { ...row, bandGapEv: Math.max(0, ip - row.electronAffinityEv) };
    } else if (key === "electronAffinityEv") {
      const ea = Number.isFinite(num) ? num : 0;
      const ip = row.electronAffinityEv + row.bandGapEv;
      next = { ...row, electronAffinityEv: ea, bandGapEv: Math.max(0, ip - ea) };
    } else if (key === "bandGapEv") {
      next = row;
    } else {
      next = { ...row, [key]: Number.isFinite(num) ? num : 0 };
    }
    return next.dopingInputMode === "fermi"
      ? withDopingFromFermi(next, temperatureK)
      : withFermiFromDoping(next, temperatureK);
  });
}

function formatDoping(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toExponential(2);
}

function displaySemField(row: LayerRow, key: TableField): string | number {
  if (key === "fermiLevelVacuumEv") return -row.fermiLevelVacuumEv;
  if (key === "ionizationPotentialEv") return row.electronAffinityEv + row.bandGapEv;
  return row[key] as string | number;
}

function inputSemFieldValue(key: TableField, raw: string): string {
  return key === "fermiLevelVacuumEv" ? String(-Number(raw)) : raw;
}

function setRowDopingMode(
  row: LayerRow,
  mode: DopingInputMode,
  temperatureK: number,
): LayerRow {
  if (row.kind === "metal") return { ...row, dopingInputMode: mode };
  return mode === "fermi"
    ? { ...withFermiFromDoping(row, temperatureK), dopingInputMode: mode }
    : { ...withDopingFromFermi(row, temperatureK), dopingInputMode: mode };
}

function moveRowTo(rows: LayerRow[], fromId: string, toId: string): LayerRow[] {
  if (fromId === toId) return rows;
  const fromIndex = rows.findIndex((row) => row.id === fromId);
  const toIndex = rows.findIndex((row) => row.id === toId);
  if (fromIndex < 0 || toIndex < 0) return rows;
  const next = [...rows];
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row!);
  return next;
}

export function LayerTable({
  rows,
  onChange,
  materialTemplates = [],
  onApplyMaterialTemplate,
  onSaveMaterialTemplate,
  temperatureK = 300,
}: LayerTableProps) {
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const enabledRowCount = rows.filter((row) => row.enabled !== false).length;
  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-xs text-slate-800">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-2 py-2 font-medium whitespace-nowrap">Order</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">On</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">Type</th>
            <th className="w-24 px-2 py-2 font-medium whitespace-nowrap">Template</th>
            {COMMON_FIELDS.map((f) => (
              <th key={f.key} className="px-2 py-2 font-medium whitespace-nowrap">
                {f.label}
              </th>
            ))}
            <th className="px-2 py-2 font-medium whitespace-nowrap">Doping</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">{PHI_FIELD.label}</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">Nd [cm⁻³]</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">Na [cm⁻³]</th>
            <th className="px-2 py-2 font-medium whitespace-nowrap">Φ_m [eV]</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isMetal = row.kind === "metal";
            const isEnabled = row.enabled !== false;

            return (
              <tr
                key={row.id}
                className={`border-t border-slate-200 hover:bg-slate-50 ${
                  draggedRowId === row.id ? "opacity-50" : ""
                } ${isEnabled ? "" : "bg-slate-50 text-slate-400"}`}
                onDragOver={(event) => {
                  if (!draggedRowId || draggedRowId === row.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggedRowId) return;
                  onChange(moveRowTo(rows, draggedRowId, row.id));
                  setDraggedRowId(null);
                }}
              >
                <td className="px-1 py-1 align-top">
                  <span
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`Drag ${row.label}`}
                    className="inline-flex h-7 w-8 cursor-grab select-none items-center justify-center rounded border border-slate-300 text-slate-500 active:cursor-grabbing"
                    onDragStart={(event) => {
                      setDraggedRowId(row.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", row.id);
                    }}
                    onDragEnd={() => setDraggedRowId(null)}
                  >
                    ⋮⋮
                  </span>
                </td>
                <td className="px-2 py-1 align-top">
                  <label className="inline-flex h-7 items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={isEnabled}
                      disabled={isEnabled && enabledRowCount <= 1}
                      aria-label={`${isEnabled ? "Disable" : "Enable"} ${row.label}`}
                      onChange={(event) =>
                        onChange(
                          updateRow(rows, row.id, {
                            enabled: event.target.checked,
                          }),
                        )
                      }
                    />
                  </label>
                </td>
                <td className="px-1 py-1">
                  <select
                    className="w-full min-w-[6.5rem] rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-950"
                    value={row.kind}
                    onChange={(e) =>
                      onChange(
                        updateRow(rows, row.id, {
                          kind: e.target.value as LayerRow["kind"],
                        }),
                      )
                    }
                  >
                    <option value="semiconductor">Semiconductor</option>
                    <option value="metal">Metal</option>
                  </select>
                </td>
                <td className="w-24 px-1 py-1">
                  <MaterialTemplateSelect
                    rowId={row.id}
                    templates={materialTemplates}
                    onApply={onApplyMaterialTemplate}
                  />
                </td>
                {COMMON_FIELDS.map((f) => (
                  <td key={f.key} className="px-1 py-1">
                    {isMetal && f.key !== "label" && f.key !== "thicknessNm" ? (
                      <span className="block px-1.5 py-1 text-slate-400">—</span>
                    ) : isMetal && f.key === "label" ? (
                      <input
                        className={inputClass}
                        type="text"
                        value={row.label}
                        onChange={(e) =>
                          onChange(
                            updateSemField(
                              rows,
                              row.id,
                              "label",
                              e.target.value,
                              temperatureK,
                            ),
                          )
                        }
                      />
                    ) : READONLY_FIELDS.has(f.key) ? (
                      <span className="block min-w-[4.5rem] px-1.5 py-1 text-slate-700">
                        {Number(displaySemField(row, f.key)).toFixed(3)}
                      </span>
                    ) : DENSITY_FIELDS.has(f.key as SemField) ? (
                      <ScientificNumberInput
                        className={inputClass}
                        value={row[f.key as SemField] as number}
                        onChange={(n) =>
                          onChange(
                            updateSemField(
                              rows,
                              row.id,
                              f.key,
                              String(n),
                              temperatureK,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        className={inputClass}
                        type={f.key === "label" ? "text" : "number"}
                        {...(f.key === "label" ? {} : numericInputAttrs)}
                        step={f.step}
                        value={displaySemField(row, f.key)}
                        onChange={(e) =>
                          onChange(
                            updateSemField(
                              rows,
                              row.id,
                              f.key,
                              inputSemFieldValue(f.key, e.target.value),
                              temperatureK,
                            ),
                          )
                        }
                      />
                    )}
                  </td>
                ))}
                <td className="px-1 py-1">
                  {isMetal ? (
                    <span className="block px-1.5 py-1 text-slate-400">—</span>
                  ) : (
                    <select
                      className="w-full min-w-[5.5rem] rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-950"
                      value={row.dopingInputMode}
                      onChange={(e) =>
                        onChange(
                          updateRow(
                            rows,
                            row.id,
                            setRowDopingMode(
                              row,
                              e.target.value as DopingInputMode,
                              temperatureK,
                            ),
                          ),
                        )
                      }
                    >
                      <option value="fermi">Φ</option>
                      <option value="direct">Nd/Na</option>
                    </select>
                  )}
                </td>
                <td className="px-1 py-1">
                  {isMetal ? (
                    <span className="block px-1.5 py-1 text-slate-400">—</span>
                  ) : row.dopingInputMode === "fermi" ? (
                    <input
                      className={inputClass}
                      type="number"
                      {...numericInputAttrs}
                      step={PHI_FIELD.step}
                      value={displaySemField(row, PHI_FIELD.key)}
                      onChange={(e) =>
                        onChange(
                          updateSemField(
                            rows,
                            row.id,
                            PHI_FIELD.key,
                            inputSemFieldValue(PHI_FIELD.key, e.target.value),
                            temperatureK,
                          ),
                        )
                      }
                    />
                  ) : (
                    <span className="block min-w-[5.5rem] px-1.5 py-1 text-slate-700">
                      {(-row.fermiLevelVacuumEv).toFixed(3)}
                    </span>
                  )}
                </td>
                {(["NdCm3", "NaCm3"] as const).map((key) => (
                  <td key={key} className="px-1 py-1">
                    {isMetal ? (
                      <span className="block px-1.5 py-1 text-slate-400">—</span>
                    ) : row.dopingInputMode === "direct" ? (
                      <ScientificNumberInput
                        className={inputClass}
                        value={row[key]}
                        onChange={(n) =>
                          onChange(updateSemField(rows, row.id, key, String(n), temperatureK))
                        }
                      />
                    ) : (
                      <span className="block min-w-[5.5rem] px-1.5 py-1 text-slate-700">
                        {formatDoping(row[key])}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-1 py-1">
                  {isMetal ? (
                    <input
                      type="number"
                      {...numericInputAttrs}
                      step="0.05"
                      className="w-full min-w-[4rem] rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-950"
                      value={row.workFunctionEv}
                      onChange={(e) =>
                        onChange(
                          updateRow(rows, row.id, {
                            workFunctionEv: Number(e.target.value),
                          }),
                        )
                      }
                    />
                  ) : (
                    <span className="block px-1.5 py-1 text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-1 align-top">
                  <div className="flex min-w-[4.5rem] items-center gap-3">
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-500 disabled:opacity-30"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(row.id)}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    className="ml-2 text-slate-600 hover:text-slate-900"
                    onClick={() => onSaveMaterialTemplate?.(row.id)}
                  >
                    Save
                  </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 border-t border-slate-200 p-2">
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          onClick={() => onChange([...rows, createSemiconductorRow(`Layer ${rows.length + 1}`)])}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
