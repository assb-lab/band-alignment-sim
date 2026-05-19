import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSimulation } from "./useSimulation.ts";
import { layerToRow } from "../lib/layerForm.ts";
import { siPnStack } from "../presets/materials.ts";

describe("useSimulation", () => {
  it("handles solver errors", async () => {
    const { result } = renderHook(() => useSimulation([]));
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.running).toBe(false);
  });

  it("surfaces ConvergenceError messages", async () => {
    const row = layerToRow(siPnStack().layers[0]!, "conv");
    row.bandGapEv = Infinity;
    const { result } = renderHook(() => useSimulation([row]));
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toContain("non-finite");
    expect(result.current.running).toBe(false);
  });

  it("stores successful results", async () => {
    const rows = siPnStack().layers.map((l, i) => layerToRow(l, `ok-${i}`));
    const { result } = renderHook(() => useSimulation(rows));
    await act(async () => {
      await result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull(), { timeout: 10_000 });
    expect(result.current.error).toBeNull();
    expect(result.current.running).toBe(false);
  });

  it("sets running while solve is in flight", async () => {
    const rows = siPnStack().layers.map((l, i) => layerToRow(l, `run-${i}`));
    const { result } = renderHook(() => useSimulation(rows));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.run();
    });
    await waitFor(() => expect(result.current.running).toBe(true));
    await act(async () => {
      await pending;
    });
    expect(result.current.running).toBe(false);
  });
});
