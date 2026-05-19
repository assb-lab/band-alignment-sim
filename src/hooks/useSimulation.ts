import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runSimulation, terminateSimulationWorker } from "../lib/simulationClient.ts";
import type { LayerStack, SimulationResult, SolverOptions } from "../physics/types.ts";
import { DEFAULT_SOLVER_OPTIONS, ConvergenceError } from "../physics/types.ts";
import { StackValidationError } from "../physics/stackContacts.ts";
import {
  layerToRow,
  rowToLayer,
  type LayerRow,
} from "../lib/layerForm.ts";

export interface SimulationState {
  rows: LayerRow[];
  temperatureK: number;
  Vapp: number;
  nodesPerNm: number;
  tol: number;
  maxGummelIter: number;
  maxNewtonIter: number;
  maxRelativeResidual: number;
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
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const requestIdRef = useRef(0);

  const stack: LayerStack = useMemo(
    () => ({
      temperatureK,
      layers: rows.map((row) => rowToLayer(row, temperatureK)),
    }),
    [rows, temperatureK],
  );

  useEffect(() => () => terminateSimulationWorker(), []);

  const run = useCallback((): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setRunning(true);
    setError(null);

    const options: SolverOptions = {
      ...DEFAULT_SOLVER_OPTIONS,
      nodesPerNm,
      tol,
      maxGummelIter,
      maxNewtonIter,
      maxRelativeResidual,
      Vapp,
    };

    return runSimulation(stack, options)
      .then((sim) => {
        if (requestId !== requestIdRef.current) return;
        setResult(sim);
      })
      .catch((e: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setError(errorMessage(e));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setRunning(false);
        }
      }) as Promise<void>;
  }, [stack, nodesPerNm, tol, maxGummelIter, maxNewtonIter, maxRelativeResidual, Vapp]);

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
    result,
    error,
    running,
    run,
    loadRows,
    layerToRow,
  };
}

export type UseSimulationReturn = ReturnType<typeof useSimulation>;
