import { solveStack } from "../physics/gummel.ts";
import { ConvergenceError } from "../physics/types.ts";
import type { LayerStack, SolverOptions } from "../physics/types.ts";
import { packSimulationResult } from "../lib/simulationTransfer.ts";

export interface SimulationWorkerRequest {
  id: number;
  stack: LayerStack;
  options: SolverOptions;
}

export type SimulationWorkerResponse =
  | { id: number; type: "ok"; payload: ReturnType<typeof packSimulationResult>["payload"] }
  | { id: number; type: "error"; message: string; errorName: string };

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { id, stack, options } = event.data;
  try {
    const result = solveStack(stack, options);
    const { payload, transfer } = packSimulationResult(result);
    const response: SimulationWorkerResponse = { id, type: "ok", payload };
    self.postMessage(response, { transfer });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const response: SimulationWorkerResponse = {
      id,
      type: "error",
      message: err.message,
      errorName: err instanceof ConvergenceError ? "ConvergenceError" : err.name,
    };
    self.postMessage(response);
  }
};
