import { numericInputAttrs } from "./numericInputAttrs.ts";
import type { ElectrodeMode } from "../physics/types.ts";

interface GlobalControlsProps {
  temperatureK: number;
  Vapp: number;
  nodesPerNm: number;
  tol: number;
  maxGummelIter: number;
  maxNewtonIter: number;
  maxRelativeResidual: number;
  electrodeMode: ElectrodeMode;
  running: boolean;
  error: string | null;
  builtInVoltageV?: number;
  liveCalc?: boolean;
  onTemperatureChange: (t: number) => void;
  onVappChange: (v: number) => void;
  onNodesPerNmChange: (n: number) => void;
  onTolChange: (tol: number) => void;
  onMaxGummelIterChange: (n: number) => void;
  onMaxNewtonIterChange: (n: number) => void;
  onMaxRelativeResidualChange: (n: number) => void;
  onElectrodeModeChange: (mode: ElectrodeMode) => void;
  onLiveCalcChange?: (enabled: boolean) => void;
  onRun: () => void;
}

export function GlobalControls({
  temperatureK,
  Vapp,
  nodesPerNm,
  tol,
  maxGummelIter,
  maxNewtonIter,
  maxRelativeResidual,
  electrodeMode,
  running,
  error,
  builtInVoltageV,
  liveCalc = false,
  onTemperatureChange,
  onVappChange,
  onNodesPerNmChange,
  onTolChange,
  onMaxGummelIterChange,
  onMaxNewtonIterChange,
  onMaxRelativeResidualChange,
  onElectrodeModeChange,
  onLiveCalcChange,
  onRun,
}: GlobalControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        T [K]
        <input
          type="number"
          {...numericInputAttrs}
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={temperatureK}
          onChange={(e) => onTemperatureChange(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Vapp [V]
        <input
          type="number"
          {...numericInputAttrs}
          step="0.05"
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={Vapp}
          onChange={(e) => onVappChange(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        nodes/nm
        <input
          type="number"
          {...numericInputAttrs}
          step="0.5"
          min="0.5"
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={nodesPerNm}
          onChange={(e) => onNodesPerNmChange(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        tol
        <input
          type="number"
          {...numericInputAttrs}
          step="1e-6"
          min="1e-12"
          className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={tol}
          onChange={(e) => onTolChange(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        rel limit
        <input
          type="number"
          {...numericInputAttrs}
          step="0.1"
          min="0.001"
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={maxRelativeResidual}
          onChange={(e) => onMaxRelativeResidualChange(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Mode
        <select
          className="w-40 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={electrodeMode}
          onChange={(e) => onElectrodeModeChange(e.target.value as ElectrodeMode)}
        >
          <option value="shorted">Shorted equilibrium</option>
          <option value="open">Open circuit</option>
          <option value="bias">Applied bias</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Gummel
        <input
          type="number"
          {...numericInputAttrs}
          step="10"
          min="1"
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={maxGummelIter}
          onChange={(e) => onMaxGummelIterChange(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Newton
        <input
          type="number"
          {...numericInputAttrs}
          step="50"
          min="1"
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
          value={maxNewtonIter}
          onChange={(e) => onMaxNewtonIterChange(Number(e.target.value))}
        />
      </label>
      <button
        type="button"
        className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        disabled={running}
        onClick={onRun}
      >
        {running && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden="true"
          />
        )}
        {running ? "計算中…" : "Run simulation"}
      </button>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={liveCalc}
          onChange={(e) => onLiveCalcChange?.(e.target.checked)}
        />
        Live
      </label>
      {builtInVoltageV !== undefined && (
        <p className="text-sm text-slate-700">Vbi = {builtInVoltageV.toFixed(3)} V</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
