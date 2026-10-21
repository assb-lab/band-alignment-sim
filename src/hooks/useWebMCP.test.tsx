import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App.tsx";
import type { ModelTool } from "../lib/webmcp.ts";

afterEach(() => {
  cleanup();
  delete (document as Document & { modelContext?: unknown }).modelContext;
  delete (navigator as Navigator & { modelContext?: unknown }).modelContext;
  vi.restoreAllMocks();
});

function installContext(legacy = false) {
  const tools = new Map<string, ModelTool>();
  const registerTool = vi.fn((tool: ModelTool, options?: { signal: AbortSignal }) => {
    if (tools.has(tool.name)) throw new Error("Duplicate tool");
    tools.set(tool.name, tool);
    options?.signal.addEventListener("abort", () => tools.delete(tool.name), { once: true });
  });
  const unregisterTool = vi.fn((name: string) => tools.delete(name));
  Object.defineProperty(legacy ? navigator : document, "modelContext", {
    configurable: true,
    value: { registerTool, unregisterTool },
  });
  const call = async (name: string, input: unknown = {}, signal?: AbortSignal) => {
    let output: unknown;
    await act(async () => {
      output = await tools.get(name)!.execute(input, signal ? { signal } : undefined);
    });
    return output as Record<string, unknown>;
  };
  return { tools, call, registerTool, unregisterTool };
}

async function ready() {
  await screen.findByText("WebMCP: 5 tools ready");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Run simulation/i })).toBeEnabled(),
  );
  fireEvent.click(screen.getByLabelText("Live"));
}

describe("WebMCP integration", () => {
  it("registers through StrictMode and runs the visible preset with serializable physical profiles", async () => {
    const { tools, call } = installContext();
    const view = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await ready();
    expect(tools.size).toBe(5);
    expect((await call("list_presets")).presets).toHaveLength(9);

    expect(
      await call("configure_simulation", {
        preset: "Si Schottky",
        temperatureK: 320,
        electrodeMode: "bias",
        Vapp: 0.1,
      }),
    ).not.toHaveProperty("error");
    expect(screen.getByLabelText("T [K]")).toHaveValue(320);
    expect(screen.getByLabelText("Mode")).toHaveValue("bias");
    expect(screen.getByLabelText("Vapp [V]")).toHaveValue(0.1);
    expect((await call("get_simulation_results")).error).toContain("run_simulation");
    const result = await call("run_simulation");
    expect(result.converged).toBe(true);
    expect(result.contactLeft).toMatchObject({ kind: "schottky" });
    expect(result.appliedVoltageV).toBe(0.1);
    expect(Number.isFinite(result.builtInVoltageV)).toBe(true);
    const profiles = await call("get_simulation_results", { maxPoints: 20 });
    expect(profiles.mesh).toHaveLength(20);
    expect((profiles.bands as unknown[]).length).toBeLessThanOrEqual(20);
    expect(JSON.parse(JSON.stringify(profiles))).toEqual(profiles);
    expect(document.querySelectorAll("svg path").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("T [K]"), { target: { value: "310" } });
    expect((await call("get_simulation_state")).temperatureK).toBe(310);
    expect((await call("get_simulation_state")).resultIsCurrent).toBe(false);
    expect((await call("get_simulation_results")).error).toContain("run_simulation");
    view.unmount();
    expect(tools.size).toBe(0);
  });

  it("applies sequential settings and direct p-doping through layerForm without stale closures", async () => {
    const { call } = installContext();
    render(<App />);
    await ready();
    await call("configure_simulation", { temperatureK: 325 });
    await call("configure_simulation", { Vapp: 0.2 });
    const state = await call("get_simulation_state");
    expect(state.temperatureK).toBe(325);
    const rows = state.rows as Array<Record<string, unknown>>;
    const row = { ...rows[0], dopingInputMode: "direct", NdCm3: 0, NaCm3: 1e16 };
    await call("configure_simulation", { rows: [row] });
    const result = await call("run_simulation");
    expect(result.converged).toBe(true);
    expect(result.appliedVoltageV).toBe(0);
    const profiles = await call("get_simulation_results");
    const bands = profiles.bands as Array<{ efnEv: number; evEv: number; ecEv: number }>;
    expect(bands.every((b) => b.efnEv > b.evEv && b.efnEv < b.ecEv)).toBe(true);
    const mesh = profiles.mesh as Array<{ pCm3: number }>;
    expect(mesh[0]!.pCm3 / 1e16).toBeCloseTo(1, 2);
  });

  it("rejects invalid payloads atomically and gives actionable errors", async () => {
    const { call } = installContext();
    render(<App />);
    await ready();
    const before = await call("get_simulation_state");
    for (const input of [
      null,
      [],
      { unknown: 1 },
      { temperatureK: NaN },
      { temperatureK: 0 },
      { electrodeMode: "wrong" },
      { maxNewtonIter: 1.5 },
      { preset: "missing" },
      { preset: "Si pn", rows: [] },
      { rows: [] },
      { rows: [{}] },
    ]) {
      expect((await call("configure_simulation", input)).error).toBeTruthy();
    }
    const rows = before.rows as Array<Record<string, unknown>>;
    for (const badRows of [
      [rows[0], rows[0]],
      [{ ...rows[0], enabled: false }],
      [{ ...rows[0], bandGapEv: 0 }],
      [{ ...rows[0], thicknessNm: 1e6 }],
      [rows[0], { ...rows[1], id: "metal", kind: "metal" }, { ...rows[0], id: "last" }],
    ]) {
      expect(
        (await call("configure_simulation", { temperatureK: 350, rows: badRows })).error,
      ).toBeTruthy();
    }
    expect((await call("get_simulation_state")).temperatureK).toBe(before.temperatureK);
    expect((await call("get_simulation_state")).rows).toEqual(before.rows);
    expect((await call("get_simulation_results", { maxPoints: 1 })).error).toBeTruthy();
    expect((await call("get_simulation_results", { maxPoints: Infinity })).error).toBeTruthy();
  });

  it("supports the legacy API without clearing other tools", async () => {
    const { tools, call, unregisterTool } = installContext(true);
    render(<App />);
    await ready();
    const output = await call("get_simulation_state");
    expect(JSON.parse((output.content as Array<{ text: string }>)[0]!.text).temperatureK).toBe(300);
    const error = await call("configure_simulation", { Vapp: "bad" });
    expect(error.isError).toBe(true);
    cleanup();
    expect(tools.size).toBe(0);
    expect(unregisterTool).toHaveBeenCalledTimes(5);
  });

  it("leaves the UI usable when unsupported or registration is denied", async () => {
    const view = render(<App />);
    expect(screen.getByText("WebMCP: unavailable in this browser")).toBeInTheDocument();
    view.unmount();
    const { tools, registerTool } = installContext();
    registerTool.mockImplementationOnce(() => {
      throw new Error("Permission denied");
    });
    render(<App />);
    await screen.findByText(/WebMCP: registration failed/);
    expect(tools.size).toBe(0);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Run simulation/i })).toBeEnabled(),
    );
  });

  it("honors execution cancellation and surfaces solver failure", async () => {
    const { tools, call } = installContext();
    render(<App />);
    await ready();
    const controller = new AbortController();
    controller.abort();
    await act(async () => {
      await expect(
        tools.get("run_simulation")!.execute({}, { signal: controller.signal }),
      ).rejects.toThrow();
    });
    await call("configure_simulation", { preset: "Si Schottky" });
    fireEvent.click(screen.getByLabelText("Disable n-Si"));
    const result = await call("run_simulation");
    expect(result).toHaveProperty("error");
    expect((await call("get_simulation_state")).error).toBeTruthy();
  });

  it("cancels an in-flight calculation and never reports the old result as current", async () => {
    const { tools, call } = installContext();
    render(<App />);
    await ready();
    const controller = new AbortController();
    await act(async () => {
      const pending = tools.get("run_simulation")!.execute({}, { signal: controller.signal });
      controller.abort();
      await expect(pending).rejects.toThrow();
    });
    expect((await call("get_simulation_state")).running).toBe(false);
    expect((await call("get_simulation_results")).error).toBeTruthy();
    expect((await call("run_simulation")).converged).toBe(true);
  });

  it("does not return success for superseded runs or settings changed during a run", async () => {
    const { tools, call } = installContext();
    render(<App />);
    await ready();
    await act(async () => {
      const first = tools.get("run_simulation")!.execute({});
      const second = tools.get("run_simulation")!.execute({});
      expect(await first).toMatchObject({ error: expect.stringContaining("superseded") });
      expect(await second).toMatchObject({ converged: true });
    });
    await act(async () => {
      const pending = tools.get("run_simulation")!.execute({});
      fireEvent.change(screen.getByLabelText("T [K]"), { target: { value: "330" } });
      expect(await pending).toMatchObject({ error: expect.stringContaining("Settings changed") });
    });
    expect((await call("get_simulation_results")).error).toBeTruthy();
  });

  it("commits a run before an immediately following results call", async () => {
    const { tools } = installContext();
    render(<App />);
    await ready();
    await act(async () => {
      await tools.get("configure_simulation")!.execute({ preset: "Si pn" });
      expect(await tools.get("run_simulation")!.execute({})).toMatchObject({ converged: true });
      const profiles = await tools.get("get_simulation_results")!.execute({ maxPoints: 10 });
      expect(profiles).toHaveProperty("mesh");
      expect(profiles).not.toHaveProperty("error");
    });
  });
});
