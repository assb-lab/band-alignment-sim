import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayerTable } from "./components/LayerTable.tsx";
import { GlobalControls } from "./components/GlobalControls.tsx";
import {
  BandDiagram,
  PreContactBandDiagram,
  SecondaryPlots,
  type SecondaryPlotTab,
} from "./components/BandDiagram.tsx";
import { SpinnerOverlay } from "./components/Spinner.tsx";
import { MaterialLibraryModal } from "./components/MaterialLibraryModal.tsx";
import { InterfaceLibraryModal } from "./components/InterfaceLibraryModal.tsx";
import { useSimulation } from "./hooks/useSimulation.ts";
import {
  createUserInterfaceTemplate,
  deleteUserInterfaceTemplate,
  interfaceElectrodeMode,
  instantiateInterfaceRows,
  listUserInterfaceTemplates,
  saveUserInterfaceTemplate,
  type InterfaceTemplate,
} from "./lib/interfaceTemplates.ts";
import {
  isLayerRowEnabled,
  layerToRow,
  rowToLayer,
  withDopingFromFermi,
  withFermiFromDoping,
} from "./lib/layerForm.ts";
import {
  applyMaterialTemplate,
  BUILT_IN_MATERIAL_TEMPLATES,
  deleteUserMaterialTemplate,
  findDuplicateMaterialTemplate,
  listUserMaterialTemplates,
  rowToMaterialTemplate,
  saveUserMaterialTemplate,
  type MaterialTemplate,
} from "./lib/materialTemplates.ts";
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
} from "./presets/materials.ts";
import type { Layer } from "./physics/types.ts";
import { preContactBands, preContactMaterialRegions } from "./physics/preContact.ts";

const PRESETS = [
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

function App() {
  const initialStack = siPnStack();
  const initialRows = initialStack.layers.map((l: Layer, i: number) =>
    layerToRow(l, `layer-${i}`, initialStack.temperatureK),
  );
  const sim = useSimulation(initialRows);
  const [plotTab, setPlotTab] = useState<SecondaryPlotTab>("phi");
  const [userMaterialTemplates, setUserMaterialTemplates] = useState<MaterialTemplate[]>([]);
  const [saveTemplateRowId, setSaveTemplateRowId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [materialLibraryOpen, setMaterialLibraryOpen] = useState(false);
  const [interfaceLibraryOpen, setInterfaceLibraryOpen] = useState(false);
  const [userInterfaceTemplates, setUserInterfaceTemplates] = useState<InterfaceTemplate[]>([]);
  const [liveCalc, setLiveCalc] = useState(true);
  const runAfterPresetRef = useRef(false);
  const { rows, run, setRows, temperatureK } = sim;
  const materialTemplates = useMemo(
    () => [...BUILT_IN_MATERIAL_TEMPLATES, ...userMaterialTemplates],
    [userMaterialTemplates],
  );
  const builtInInterfaceTemplates = useMemo<InterfaceTemplate[]>(
    () =>
      PRESETS.map((preset, index) => {
        const stack = preset.stack();
        return {
          id: `builtin-interface-${index}`,
          source: "built-in",
          name: preset.name,
          electrodeMode: "shorted",
          rows: stack.layers.map((layer: Layer, layerIndex: number) =>
            layerToRow(layer, `builtin-interface-${index}-${layerIndex}`, stack.temperatureK),
          ),
        };
      }),
    [],
  );
  const saveTemplateRow = rows.find((item) => item.id === saveTemplateRowId);
  const preContactPreview = useMemo(() => {
    const activeRows = rows.filter(isLayerRowEnabled);
    const stack = {
      layers: activeRows.map((row) => rowToLayer(row, temperatureK)),
      temperatureK,
    };
    return {
      bands: preContactBands(stack),
      regions: preContactMaterialRegions(stack),
    };
  }, [rows, temperatureK]);

  useEffect(() => {
    if (!runAfterPresetRef.current) return;
    runAfterPresetRef.current = false;
    run();
  }, [rows, run]);

  useEffect(() => {
    if (!liveCalc) return;
    run();
  }, [liveCalc, run]);

  useEffect(() => {
    listUserMaterialTemplates()
      .then(setUserMaterialTemplates)
      .catch(() => setUserMaterialTemplates([]));
  }, []);

  useEffect(() => {
    listUserInterfaceTemplates()
      .then(setUserInterfaceTemplates)
      .catch(() => setUserInterfaceTemplates([]));
  }, []);

  const loadInterfaceTemplate = useCallback(
    (template: InterfaceTemplate) => {
      runAfterPresetRef.current = !liveCalc;
      sim.setElectrodeMode(interfaceElectrodeMode(template));
      sim.loadRows(instantiateInterfaceRows(template));
      setInterfaceLibraryOpen(false);
    },
    [liveCalc, sim],
  );

  const createInterfaceTemplate = useCallback(
    (nameRaw: string, overwriteId?: string): Promise<string | null> => {
      const name = nameRaw.trim();
      if (!name) return Promise.resolve("Interface name is required.");
      const builtInDuplicate = builtInInterfaceTemplates.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (builtInDuplicate) {
        return Promise.resolve(`Built-in interface cannot be overwritten: ${builtInDuplicate.name}`);
      }
      const userDuplicate = userInterfaceTemplates.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (userDuplicate && userDuplicate.id !== overwriteId) {
        return Promise.resolve(`Interface already exists: ${userDuplicate.name}`);
      }
      const template: InterfaceTemplate = overwriteId
        ? {
            id: overwriteId,
            source: "user",
            name,
            electrodeMode: sim.electrodeMode,
            rows: rows.map((row) => ({ ...row })),
          }
        : createUserInterfaceTemplate(rows, sim.electrodeMode, name);
      return saveUserInterfaceTemplate(template).then((saved) => {
        setUserInterfaceTemplates((prev) =>
          prev.some((item) => item.id === saved.id)
            ? prev.map((item) => (item.id === saved.id ? saved : item))
            : [...prev, saved],
        );
        return null;
      });
    },
    [builtInInterfaceTemplates, rows, sim.electrodeMode, userInterfaceTemplates],
  );

  const renameInterfaceTemplate = useCallback(
    (id: string, nameRaw: string): Promise<string | null> => {
      const name = nameRaw.trim();
      if (!name) return Promise.resolve("Interface name is required.");
      const duplicate = [...builtInInterfaceTemplates, ...userInterfaceTemplates].find(
        (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate) return Promise.resolve(`Interface already exists: ${duplicate.name}`);
      const current = userInterfaceTemplates.find((item) => item.id === id);
      if (!current) return Promise.resolve("Interface not found.");
      const next = { ...current, name };
      return saveUserInterfaceTemplate(next).then((saved) => {
        setUserInterfaceTemplates((prev) =>
          prev.map((item) => (item.id === saved.id ? saved : item)),
        );
        return null;
      });
    },
    [builtInInterfaceTemplates, userInterfaceTemplates],
  );

  const deleteInterfaceTemplate = useCallback((id: string): Promise<void> => {
    return deleteUserInterfaceTemplate(id).then(() => {
      setUserInterfaceTemplates((prev) => prev.filter((item) => item.id !== id));
    });
  }, []);

  const applyTemplate = useCallback(
    (rowId: string, templateId: string) => {
      const template = materialTemplates.find((item) => item.id === templateId);
      if (!template) return;
      setRows(
        rows.map((row) =>
          row.id === rowId
            ? (() => {
                const next = applyMaterialTemplate(row, template);
                return next.dopingInputMode === "fermi"
                  ? withDopingFromFermi(next, temperatureK)
                  : withFermiFromDoping(next, temperatureK);
              })()
            : row,
        ),
      );
    },
    [materialTemplates, rows, setRows, temperatureK],
  );

  const openSaveTemplate = useCallback(
    (rowId: string) => {
      const row = rows.find((item) => item.id === rowId);
      if (!row) return;
      setTemplateNameDraft(row.label);
      setSaveTemplateError(null);
      setSaveTemplateRowId(rowId);
    },
    [rows],
  );

  const closeSaveTemplate = useCallback(() => {
    setSaveTemplateRowId(null);
    setTemplateNameDraft("");
    setSaveTemplateError(null);
  }, []);

  const confirmSaveTemplate = useCallback(() => {
    const row = rows.find((item) => item.id === saveTemplateRowId);
    if (!row) {
      closeSaveTemplate();
      return;
    }
    const name = templateNameDraft.trim();
    if (!name) {
      setSaveTemplateError("Template name is required.");
      return;
    }
    const template = rowToMaterialTemplate(row, name);
    const duplicate = findDuplicateMaterialTemplate(template, materialTemplates);
    if (duplicate) {
      setSaveTemplateError(`Material template already exists: ${duplicate.name}`);
      return;
    }
    saveUserMaterialTemplate(template).then((saved) => {
      setUserMaterialTemplates((prev) => [...prev, saved]);
      closeSaveTemplate();
    });
  }, [closeSaveTemplate, materialTemplates, rows, saveTemplateRowId, templateNameDraft]);

  const upsertMaterialTemplate = useCallback(
    (template: MaterialTemplate): Promise<string | null> => {
      const name = template.name.trim();
      if (!name) return Promise.resolve("Material name is required.");
      const normalized = { ...template, name, source: "user" as const };
      const duplicate = findDuplicateMaterialTemplate(
        normalized,
        materialTemplates.filter((item) => item.id !== normalized.id),
      );
      if (duplicate) {
        return Promise.resolve(`Material template already exists: ${duplicate.name}`);
      }
      return saveUserMaterialTemplate(normalized).then((saved) => {
        setUserMaterialTemplates((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          return exists
            ? prev.map((item) => (item.id === saved.id ? saved : item))
            : [...prev, saved];
        });
        return null;
      });
    },
    [materialTemplates],
  );

  const deleteMaterialTemplate = useCallback((id: string): Promise<void> => {
    return deleteUserMaterialTemplate(id).then(() => {
      setUserMaterialTemplates((prev) => prev.filter((item) => item.id !== id));
    });
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white py-4">
        <div className="mx-auto w-[calc(100%-2rem)] max-w-[1800px]">
          <h1 className="text-xl font-semibold tracking-tight">Band Alignment Simulator</h1>
          <p className="mt-1 text-sm text-slate-600">
            1D Poisson + Boltzmann — stack layers include metal rows for Schottky contacts
          </p>
        </div>
      </header>

      <main className="mx-auto grid w-[calc(100%-2rem)] max-w-[1800px] gap-6 py-6 lg:grid-cols-[minmax(520px,0.95fr)_minmax(640px,1.25fr)]">
        <section className="space-y-4">
          <GlobalControls
            temperatureK={sim.temperatureK}
            Vapp={sim.Vapp}
            nodesPerNm={sim.nodesPerNm}
            tol={sim.tol}
            maxGummelIter={sim.maxGummelIter}
            maxNewtonIter={sim.maxNewtonIter}
            maxRelativeResidual={sim.maxRelativeResidual}
            electrodeMode={sim.electrodeMode}
            running={sim.running}
            error={sim.error}
            builtInVoltageV={sim.result?.builtInVoltageV}
            liveCalc={liveCalc}
            onTemperatureChange={sim.setTemperatureK}
            onVappChange={sim.setVapp}
            onNodesPerNmChange={sim.setNodesPerNm}
            onTolChange={sim.setTol}
            onMaxGummelIterChange={sim.setMaxGummelIter}
            onMaxNewtonIterChange={sim.setMaxNewtonIter}
            onMaxRelativeResidualChange={sim.setMaxRelativeResidual}
            onElectrodeModeChange={sim.setElectrodeMode}
            onLiveCalcChange={setLiveCalc}
            onRun={sim.run}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => setMaterialLibraryOpen(true)}
            >
              Materials
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => setInterfaceLibraryOpen(true)}
            >
              Interfaces
            </button>
          </div>

          <LayerTable
            rows={sim.rows}
            onChange={sim.setRows}
            materialTemplates={materialTemplates}
            onApplyMaterialTemplate={applyTemplate}
            onSaveMaterialTemplate={openSaveTemplate}
            temperatureK={sim.temperatureK}
          />
        </section>

        <section className="relative space-y-4">
          {sim.running && <SpinnerOverlay label="Poisson を解いています…" />}
          <PreContactBandDiagram preview={preContactPreview} />
          <BandDiagram result={sim.result} />
          <div className="flex gap-2">
            {(
              [
                ["phi", "φ"],
                ["field", "E"],
                ["carriers", "n,p"],
                ["rho", "ρ"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded px-3 py-1 text-sm ${plotTab === key ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setPlotTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <SecondaryPlots result={sim.result} tab={plotTab} />
        </section>
      </main>

      {saveTemplateRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-template-title"
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              confirmSaveTemplate();
            }}
          >
            <h2 id="save-template-title" className="text-base font-semibold text-slate-950">
              Save material
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Save material constants for {saveTemplateRow?.label ?? "this row"}.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm text-slate-700">
              Template name
              <input
                autoFocus
                className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
                value={templateNameDraft}
                onChange={(e) => {
                  setTemplateNameDraft(e.target.value);
                  setSaveTemplateError(null);
                }}
              />
            </label>
            {saveTemplateError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {saveTemplateError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={closeSaveTemplate}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save template
              </button>
            </div>
          </form>
        </div>
      )}
      {materialLibraryOpen && (
        <MaterialLibraryModal
          builtInTemplates={BUILT_IN_MATERIAL_TEMPLATES}
          userTemplates={userMaterialTemplates}
          onClose={() => setMaterialLibraryOpen(false)}
          onSave={upsertMaterialTemplate}
          onDelete={deleteMaterialTemplate}
        />
      )}
      {interfaceLibraryOpen && (
        <InterfaceLibraryModal
          builtInTemplates={builtInInterfaceTemplates}
          userTemplates={userInterfaceTemplates}
          defaultName="Current interface"
          onClose={() => setInterfaceLibraryOpen(false)}
          onCreate={createInterfaceTemplate}
          onRename={renameInterfaceTemplate}
          onDelete={deleteInterfaceTemplate}
          onLoad={loadInterfaceTemplate}
        />
      )}
    </div>
  );
}

export default App;
