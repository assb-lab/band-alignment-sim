import { solveStack } from "../physics/gummel.ts";
import type { LayerStack, SimulationResult, SolverOptions } from "../physics/types.ts";
import { ConvergenceError } from "../physics/types.ts";
import { unpackSimulationResult } from "./simulationTransfer.ts";
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from "../workers/simulation.worker.ts";

export type SimulationRunner = (
  stack: LayerStack,
  options: SolverOptions,
) => Promise<SimulationResult>;

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<
  number,
  { resolve: (r: SimulationResult) => void; reject: (e: Error) => void }
>();

function canUseWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    import.meta.env.MODE !== "test" &&
    !import.meta.env.VITEST
  );
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
      const msg = event.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.type === "ok") {
        entry.resolve(unpackSimulationResult(msg.payload));
        return;
      }
      const err =
        msg.errorName === "ConvergenceError"
          ? new ConvergenceError(msg.message)
          : new Error(msg.message);
      entry.reject(err);
    };
    worker.onerror = (event) => {
      const err = event.error instanceof Error ? event.error : new Error(event.message);
      for (const [, entry] of pending) {
        entry.reject(err);
      }
      pending.clear();
    };
  }
  return worker;
}

function runOnWorker(stack: LayerStack, options: SolverOptions): Promise<SimulationResult> {
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: SimulationWorkerRequest = { id, stack, options };
    getWorker().postMessage(request);
  });
}

/** Run equilibrium solve off the main thread when a Worker is available. */
export function runSimulation(stack: LayerStack, options: SolverOptions): Promise<SimulationResult> {
  if (canUseWorker()) {
    return runOnWorker(stack, options);
  }
  return Promise.resolve().then(() => solveStack(stack, options));
}

/** Terminate the shared worker (e.g. on unmount). */
export function terminateSimulationWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const [, entry] of pending) {
    entry.reject(new Error("Simulation worker terminated"));
  }
  pending.clear();
}

/** @internal Test hook to force main-thread execution. */
export function __runSimulationSync(
  stack: LayerStack,
  options: SolverOptions,
): SimulationResult {
  return solveStack(stack, options);
}
