import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runSimulation, terminateSimulationWorker } from "../lib/simulationClient.ts";
import type {
  ElectrodeMode,
  LayerStack,
  SimulationResult,
  SolverOptions,
} from "../physics/types.ts";
import { DEFAULT_SOLVER_OPTIONS, ConvergenceError } from "../physics/types.ts";
import { StackValidationError } from "../physics/stackContacts.ts";
import { layerToRow, isLayerRowEnabled, rowToLayer, type LayerRow } from "../lib/layerForm.ts";

export interface SimulationState {
  rows: LayerRow[];
  temperatureK: number;
  Vapp: number;
  nodesPerNm: number;
  tol: number;
  maxGummelIter: number;
  maxNewtonIter: number;
  maxRelativeResidual: number;
  electrodeMode: ElectrodeMode;
  result: SimulationResult | null;
  error: string | null;
  running: boolean;
}

function errorMessage(e: unknown): string {
  if (e instanceof ConvergenceError || e instanceof StackValidationError) {
    return e.message;
  }
  return String(e);
}

export function useSimulation(initialRows: LayerRow[], initialT = 300) {
  const [rows, setRows] = useState(initialRows);
  const [temperatureK, setTemperatureK] = useState(initialT);
  const [Vapp, setVapp] = useState(0);
  const [nodesPerNm, setNodesPerNm] = useState(DEFAULT_SOLVER_OPTIONS.nodesPerNm);
  const [tol, setTol] = useState(DEFAULT_SOLVER_OPTIONS.tol);
  const [maxGummelIter, setMaxGummelIter] = useState(DEFAULT_SOLVER_OPTIONS.maxGummelIter);
  const [maxNewtonIter, setMaxNewtonIter] = useState(DEFAULT_SOLVER_OPTIONS.maxNewtonIter);
  const [maxRelativeResidual, setMaxRelativeResidual] = useState(2);
  const [electrodeMode, setElectrodeMode] = useState<ElectrodeMode>("shorted");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [resultInputKey, setResultInputKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inputKey = JSON.stringify([
    rows,
    temperatureK,
    Vapp,
    nodesPerNm,
    tol,
    maxGummelIter,
    maxNewtonIter,
    maxRelativeResidual,
    electrodeMode,
  ]);

  const stack: LayerStack = useMemo(
    () => ({
      temperatureK,
      layers: rows.filter(isLayerRowEnabled).map((row) => rowToLayer(row, temperatureK)),
    }),
    [rows, temperatureK],
  );

  useEffect(() => () => terminateSimulationWorker(), []);

  const runForAgent = useCallback(
    (
      signal?: AbortSignal,
      commit: (update: () => void) => void = (update) => update(),
    ): Promise<SimulationResult> => {
      signal?.throwIfAborted();
      const requestId = ++requestIdRef.current;
      commit(() => {
        setRunning(true);
        setError(null);
      });
      const cancel = () => {
        if (requestId !== requestIdRef.current) return;
        ++requestIdRef.current;
        terminateSimulationWorker();
        setRunning(false);
        setResult(null);
      };
      signal?.addEventListener("abort", cancel, { once: true });

      const options: SolverOptions = {
        ...DEFAULT_SOLVER_OPTIONS,
        nodesPerNm,
        tol,
        maxGummelIter,
        maxNewtonIter,
        maxRelativeResidual,
        electrodeMode,
        Vapp: electrodeMode === "bias" ? Vapp : 0,
      };

      return runSimulation(stack, options)
        .then((sim) => {
          signal?.throwIfAborted();
          if (requestId !== requestIdRef.current)
            throw new Error(
              "Simulation superseded by a newer run. Retry with the current settings.",
            );
          commit(() => {
            setResult(sim);
            setResultInputKey(inputKey);
            setRunning(false);
          });
          return sim;
        })
        .catch((e: unknown) => {
          if (requestId === requestIdRef.current) {
            commit(() => {
              setResult(null);
              setError(errorMessage(e));
              setRunning(false);
            });
          }
          throw e;
        })
        .finally(() => {
          signal?.removeEventListener("abort", cancel);
        });
    },
    [
      stack,
      nodesPerNm,
      tol,
      maxGummelIter,
      maxNewtonIter,
      maxRelativeResidual,
      electrodeMode,
      Vapp,
      inputKey,
    ],
  );

  const run = useCallback(
    (): Promise<void> =>
      runForAgent().then(
        () => undefined,
        () => undefined,
      ),
    [runForAgent],
  );

  const loadRows = useCallback((next: LayerRow[]) => {
    setRows(next);
    setResult(null);
    setError(null);
  }, []);

  return {
    rows,
    setRows,
    temperatureK,
    setTemperatureK,
    Vapp,
    setVapp,
    nodesPerNm,
    setNodesPerNm,
    tol,
    setTol,
    maxGummelIter,
    setMaxGummelIter,
    maxNewtonIter,
    setMaxNewtonIter,
    maxRelativeResidual,
    setMaxRelativeResidual,
    electrodeMode,
    setElectrodeMode,
    result,
    resultIsCurrent: result !== null && resultInputKey === inputKey,
    error,
    running,
    run,
    runForAgent,
    loadRows,
    layerToRow,
  };
}

export type UseSimulationReturn = ReturnType<typeof useSimulation>;
