import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createSimulationTools, type ModelTool, type SimulationSettings } from "../lib/webmcp.ts";
import type { UseSimulationReturn } from "./useSimulation.ts";

interface ModelContext {
  registerTool: (tool: ModelTool, options?: { signal: AbortSignal }) => void | Promise<void>;
  unregisterTool?: (name: string) => void;
}

export function useWebMCP(sim: UseSimulationReturn): string {
  const latest = useRef(sim);
  useLayoutEffect(() => {
    latest.current = sim;
  });
  const [status, setStatus] = useState("WebMCP: unavailable in this browser");

  useEffect(() => {
    const modern = (document as Document & { modelContext?: ModelContext }).modelContext;
    const legacy = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    const context = modern ?? legacy;
    if (!context || typeof context.registerTool !== "function") return;
    const registration = new AbortController();
    const executions = new AbortController();
    const registered: string[] = [];
    const apply = (settings: SimulationSettings) =>
      flushSync(() => {
        const current = latest.current;
        current.loadRows(settings.rows);
        current.setTemperatureK(settings.temperatureK);
        current.setVapp(settings.Vapp);
        current.setElectrodeMode(settings.electrodeMode);
        current.setNodesPerNm(settings.nodesPerNm);
        current.setTol(settings.tol);
        current.setMaxGummelIter(settings.maxGummelIter);
        current.setMaxNewtonIter(settings.maxNewtonIter);
        current.setMaxRelativeResidual(settings.maxRelativeResidual);
      });
    const tools = createSimulationTools(() => latest.current, apply, flushSync);
    const cleanup = () => {
      registration.abort();
      executions.abort();
      if (!modern) registered.splice(0).forEach((name) => context.unregisterTool?.(name));
    };
    const register = async () => {
      try {
        // Start all registrations before yielding, so StrictMode cleanup can abort them together.
        await Promise.all(
          tools.map(async (tool) => {
            const wrapped: ModelTool = {
              ...tool,
              execute: async (input, options) => {
                const signal = options?.signal
                  ? AbortSignal.any([options.signal, executions.signal])
                  : executions.signal;
                const result = await tool.execute(input, { signal });
                return modern
                  ? result
                  : {
                      content: [{ type: "text", text: JSON.stringify(result) }],
                      ...(result && typeof result === "object" && "error" in result
                        ? { isError: true }
                        : {}),
                    };
              },
            };
            const pending = context.registerTool(
              wrapped,
              modern ? { signal: registration.signal } : undefined,
            );
            if (!modern && pending === undefined) registered.push(tool.name);
            await pending;
            if (!modern && pending !== undefined) {
              if (registration.signal.aborted) context.unregisterTool?.(tool.name);
              else registered.push(tool.name);
            }
          }),
        );
        if (!registration.signal.aborted) setStatus(`WebMCP: ${tools.length} tools ready`);
      } catch (error) {
        if (registration.signal.aborted) return;
        cleanup();
        setStatus(
          `WebMCP: registration failed (${error instanceof Error ? error.message : String(error)})`,
        );
      }
    };
    void register();
    return cleanup;
  }, []);

  return status;
}
