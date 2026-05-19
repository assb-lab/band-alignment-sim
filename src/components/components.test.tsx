import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BandDiagram, PreContactBandDiagram, SecondaryPlots } from "../components/BandDiagram.tsx";
import { LayerTable } from "../components/LayerTable.tsx";
import { GlobalControls } from "../components/GlobalControls.tsx";
import { solveStack } from "../physics/gummel.ts";
import type { ElectrodeMode } from "../physics/types.ts";
import { preContactBands, preContactMaterialRegions } from "../physics/preContact.ts";
import { siPnStack, siSchottkyNStack } from "../presets/materials.ts";
import { createMetalRow, layerToRow } from "../lib/layerForm.ts";
import { BUILT_IN_MATERIAL_TEMPLATES } from "../lib/materialTemplates.ts";

describe("components", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const result = solveStack(siPnStack(), {
    nodesPerNm: 1,
    minNodesPerLayer: 15,
    tol: 1e-4,
    maxGummelIter: 1,
    maxNewtonIter: 400,
    Vapp: 0,
  });
  const preContactPreview = (stack: ReturnType<typeof siPnStack>) => ({
    bands: preContactBands(stack),
    regions: preContactMaterialRegions(stack),
  });

  it("renders secondary plot tabs", () => {
    const { rerender } = render(<SecondaryPlots result={result} tab="phi" />);
    expect(document.querySelector("path")).toBeTruthy();
    rerender(<SecondaryPlots result={result} tab="field" />);
    rerender(<SecondaryPlots result={result} tab="carriers" />);
    rerender(<SecondaryPlots result={result} tab="rho" />);
    expect(document.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("renders empty band diagram message", () => {
    render(<BandDiagram result={null} />);
    expect(screen.getByText(/Run simulation/i)).toBeTruthy();
  });

  it("renders pre-contact vacuum reference band diagram", () => {
    render(<PreContactBandDiagram preview={preContactPreview(siPnStack())} />);
    expect(screen.getByRole("img", { name: /Pre-contact/i })).toBeTruthy();
    expect(screen.getByText(/Vacuum level/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Equal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thickness" })).toBeTruthy();
    expect(
      Array.from(document.querySelectorAll("text")).some((text) =>
        text.textContent?.startsWith("EF="),
      ),
    ).toBe(true);
    expect(document.querySelector('tspan[baseline-shift="sub"]')?.textContent).toBe("F");
    expect(screen.queryByText("CBM")).toBeNull();
    expect(screen.queryByText("VBM")).toBeNull();
  });

  it("renders metal in pre-contact vacuum reference band diagram", () => {
    render(<PreContactBandDiagram preview={preContactPreview(siSchottkyNStack())} />);
    expect(screen.getByText("Au")).toBeTruthy();
    expect(screen.getByText("n-Si")).toBeTruthy();
    const metalEf = document.querySelector('[data-role="metal-ef"]');
    expect(metalEf?.getAttribute("stroke")).toBe("#111827");
    expect(metalEf?.getAttribute("stroke-width")).toBe("2");
    expect(metalEf?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("updates pre-contact labels from input-derived preview without a run result", () => {
    const stack = siPnStack();
    const { rerender } = render(<PreContactBandDiagram preview={preContactPreview(stack)} />);
    expect(screen.getAllByText("EA= 4.05 eV").length).toBeGreaterThan(0);

    stack.layers[0]!.electronAffinityEv = 4.35;
    rerender(<PreContactBandDiagram preview={preContactPreview(stack)} />);
    expect(screen.getByText("EA= 4.35 eV")).toBeTruthy();
  });

  it("does not draw material transition arrows in the pre-contact diagram", () => {
    render(<PreContactBandDiagram preview={preContactPreview(siPnStack())} />);
    const arrowedBandLines = Array.from(
      document.querySelectorAll('line[marker-end="url(#precontact-arrow)"]'),
    ).filter((line) => ["#ef0000", "#1747ff"].includes(line.getAttribute("stroke") ?? ""));
    expect(arrowedBandLines).toHaveLength(0);
  });

  it("renders metal in post-contact band diagram", () => {
    const schottky = solveStack(siSchottkyNStack(), {
      nodesPerNm: 1,
      minNodesPerLayer: 15,
      tol: 1e-4,
      maxGummelIter: 1,
      maxNewtonIter: 400,
      Vapp: 0,
    });
    render(<BandDiagram result={schottky} />);
    expect(screen.getByText("Au")).toBeTruthy();
    expect(screen.getByText("n-Si")).toBeTruthy();
    const metalEf = document.querySelector('[data-role="metal-ef"]');
    expect(metalEf?.getAttribute("stroke")).toBe("#111827");
    expect(metalEf?.getAttribute("stroke-width")).toBe("2");
    expect(metalEf?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("renders post-contact Ec red and Ev blue with readable labels", () => {
    render(<BandDiagram result={result} />);
    expect(document.querySelector('path[stroke="#ef0000"]')).toBeTruthy();
    expect(document.querySelector('path[stroke="#1747ff"]')).toBeTruthy();
    expect(screen.getByText("Ec").getAttribute("stroke")).toBe("white");
    expect(screen.getByText("Ev").getAttribute("stroke")).toBe("white");
    expect(screen.getByText("EF")).toBeTruthy();
    expect(screen.queryByText("Efn")).toBeNull();
    expect(screen.queryByText("Efp")).toBeNull();
  });

  it("opens plot export menu from the SVG context menu", () => {
    render(<BandDiagram result={result} />);
    fireEvent.contextMenu(screen.getByRole("img", { name: "Band diagram" }), {
      clientX: 50,
      clientY: 60,
    });
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Export SVG" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Export PNG" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Export ITX" })).toBeTruthy();
  });

  it("exports ITX from each plot context menu", () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:itx");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
      downloads.push(this.download);
    });

    render(<PreContactBandDiagram preview={preContactPreview(siPnStack())} />);
    fireEvent.contextMenu(screen.getByRole("img", { name: /Pre-contact/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export ITX" }));
    expect(downloads).toContain("pre-contact-band-diagram.itx");

    cleanup();
    render(<BandDiagram result={result} />);
    fireEvent.contextMenu(screen.getByRole("img", { name: "Band diagram" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export ITX" }));
    expect(downloads).toContain("band-diagram.itx");

    cleanup();
    render(<SecondaryPlots result={result} tab="phi" />);
    fireEvent.contextMenu(document.querySelector("svg")!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Export ITX" }));
    expect(downloads).toContain("phi-plot.itx");
    expect(createObjectUrl).toHaveBeenCalled();
  });

  it("pans a plot during Alt drag before pointer release", () => {
    render(<BandDiagram result={result} />);
    const interaction = Array.from(document.querySelectorAll("rect")).find(
      (rect) => rect.getAttribute("fill") === "transparent",
    )!;
    const beforeTicks = Array.from(document.querySelectorAll("g.tick text")).map(
      (text) => text.textContent,
    );
    fireEvent.pointerDown(interaction, {
      altKey: true,
      clientX: 400,
      clientY: 240,
      pointerId: 1,
    });
    fireEvent.pointerMove(interaction, {
      altKey: true,
      clientX: 330,
      clientY: 210,
      pointerId: 1,
    });
    const afterTicks = Array.from(document.querySelectorAll("g.tick text")).map(
      (text) => text.textContent,
    );
    expect(afterTicks).not.toEqual(beforeTicks);
    fireEvent.pointerUp(interaction, {
      altKey: true,
      clientX: 330,
      clientY: 210,
      pointerId: 1,
    });
  });

  it("clips plotted paths to the chart frame", () => {
    render(<BandDiagram result={result} />);
    const path = document.querySelector('path[stroke="#ef0000"]')!;
    expect(path.closest("g")?.getAttribute("clip-path")).toMatch(/^url\(#plot-clip-/);

    cleanup();
    render(<SecondaryPlots result={result} tab="phi" />);
    const secondaryPath = document.querySelector('path[stroke="#4f46e5"]')!;
    expect(secondaryPath.closest("g")?.getAttribute("clip-path")).toMatch(/^url\(#plot-clip-/);
  });

  it("shows drag zoom controls for chart components", () => {
    render(<BandDiagram result={result} />);
    expect(screen.getByText("Drag zoom")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "X" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Y" })).toBeNull();
    expect(screen.queryByRole("button", { name: "XY" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });

  it("handles layer table edits", () => {
    const rows = [layerToRow(siPnStack().layers[0]!, "a")];
    let updated = rows;
    const onChange = (next: typeof rows) => {
      updated = next;
    };
    render(<LayerTable rows={rows} onChange={onChange} />);
    expect(screen.queryByText("Doping input")).toBeNull();
    expect(screen.getByRole("button", { name: "✕" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "+ Add" })[0]!);
    expect(updated.length).toBe(2);
    const input = screen.getAllByDisplayValue("p-Si")[0]!;
    fireEvent.change(input, { target: { value: "p-Si edited" } });
    expect(updated[0]!.label).toBe("p-Si edited");
    fireEvent.click(screen.getAllByRole("button", { name: "✕" })[0]!);
    expect(updated.length).toBe(1);
    fireEvent.click(screen.getAllByRole("button", { name: "✕" })[0]!);
    expect(updated.length).toBe(1);
    const thickness = document.querySelector('tbody tr input[type="number"][step="1"]') as HTMLInputElement;
    fireEvent.change(thickness, { target: { value: "not-a-number" } });
    expect(updated[0]!.thicknessNm).toBe(0);
  });

  it("edits EA and IP while keeping Eg read-only", () => {
    const rows = [layerToRow(siPnStack().layers[0]!, "a")];
    let updated = rows;
    render(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          updated = next;
        }}
      />,
    );

    expect(screen.getByText("EA [eV]")).toBeTruthy();
    expect(screen.getByText("IP [eV]")).toBeTruthy();
    expect(screen.getByText("Eg [eV]")).toBeTruthy();
    expect(screen.queryByText("χ [eV]")).toBeNull();
    expect(screen.getByText("1.120")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("5.17"), { target: { value: "5.50" } });
    expect(updated[0]!.electronAffinityEv).toBeCloseTo(4.05);
    expect(updated[0]!.bandGapEv).toBeCloseTo(1.45);
  });

  it("allows editing thickness for metal rows", () => {
    const rows = [createMetalRow("Au", 5.1)];
    let updated = rows;
    render(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          updated = next;
        }}
      />,
    );

    const thickness = document.querySelector(
      'tbody tr input[type="number"][step="1"]',
    ) as HTMLInputElement;
    fireEvent.change(thickness, { target: { value: "35" } });
    expect(updated[0]!.thicknessNm).toBe(35);
  });

  it("reorders layer table rows", () => {
    let rows = siPnStack().layers.map((layer, index) => layerToRow(layer, `row-${index}`));
    const onChange = (next: typeof rows) => {
      rows = next;
    };
    render(<LayerTable rows={rows} onChange={onChange} />);

    const dataTransfer = {
      dropEffect: "",
      effectAllowed: "",
      setData: () => {},
      getData: () => "",
    };
    fireEvent.dragStart(screen.getByRole("button", { name: "Drag p-Si" }), { dataTransfer });
    fireEvent.dragOver(screen.getByDisplayValue("n-Si").closest("tr")!, { dataTransfer });
    fireEvent.drop(screen.getByDisplayValue("n-Si").closest("tr")!, { dataTransfer });
    expect(rows.map((row) => row.label)).toEqual(["n-Si", "p-Si"]);
  });

  it("toggles layer rows on and off without removing them", () => {
    let rows = siPnStack().layers.map((layer, index) => layerToRow(layer, `row-${index}`));
    const { rerender } = render(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          rows = next;
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Disable p-Si"));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.enabled).toBe(false);

    rerender(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          rows = next;
        }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Enable p-Si"));
    expect(rows[0]!.enabled).toBe(true);
  });

  it("applies and saves material templates from layer table", () => {
    const rows = [layerToRow(siPnStack().layers[0]!, "a")];
    const applied: string[] = [];
    let saved = "";
    render(
      <LayerTable
        rows={rows}
        onChange={() => {}}
        materialTemplates={BUILT_IN_MATERIAL_TEMPLATES}
        onApplyMaterialTemplate={(rowId, templateId) => applied.push(`${rowId}:${templateId}`)}
        onSaveMaterialTemplate={(rowId) => {
          saved = rowId;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));
    fireEvent.click(screen.getByRole("option", { name: "n-GaAs" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(applied).toEqual(["a:builtin-gaas-n"]);
    expect(saved).toBe("a");
  });

  it("switches doping input mode per layer row", () => {
    let rows = [layerToRow(siPnStack().layers[0]!, "a")];
    const { rerender } = render(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          rows = next;
        }}
      />,
    );

    fireEvent.change(screen.getAllByRole("combobox")[1]!, {
      target: { value: "direct" },
    });
    expect(rows[0]!.dopingInputMode).toBe("direct");

    rerender(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          rows = next;
        }}
      />,
    );
    expect(screen.getAllByDisplayValue("Nd/Na").length).toBeGreaterThan(0);
  });

  it("shows semiconductor work function as the sign-flipped vacuum Fermi level", () => {
    const rows = [layerToRow(siPnStack().layers[0]!, "a")];
    let updated = rows;
    render(
      <LayerTable
        rows={rows}
        onChange={(next) => {
          updated = next;
        }}
      />,
    );

    expect(screen.getByText("Φ [eV]")).toBeTruthy();
    const numericInputs = Array.from(
      document.querySelectorAll('tbody tr input[type="number"][step="0.01"]'),
    ) as HTMLInputElement[];
    const phiInput = numericInputs[numericInputs.length - 1]!;
    expect(Number(phiInput.value)).toBeCloseTo(-rows[0]!.fermiLevelVacuumEv);

    fireEvent.change(phiInput, { target: { value: "4.9" } });
    expect(updated[0]!.fermiLevelVacuumEv).toBeCloseTo(-4.9);
  });

  it("shows error in global controls", () => {
    render(
      <GlobalControls
        temperatureK={300}
        Vapp={0}
        nodesPerNm={2}
        tol={1e-6}
        maxGummelIter={80}
        maxNewtonIter={800}
        maxRelativeResidual={2}
        electrodeMode="shorted"
        running={true}
        error="Solver failed"
        onTemperatureChange={() => {}}
        onVappChange={() => {}}
        onNodesPerNmChange={() => {}}
        onTolChange={() => {}}
        onMaxGummelIterChange={() => {}}
        onMaxNewtonIterChange={() => {}}
        onMaxRelativeResidualChange={() => {}}
        onElectrodeModeChange={() => {}}
        onRun={() => {}}
      />,
    );
    expect(screen.getByText("Solver failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /計算中/i })).toBeDisabled();
  });

  it("shows built-in voltage in global controls", () => {
    let t = 300;
    let v = 0.2;
    let n = 2;
    let tol = 1e-6;
    let rel = 2;
    let gummel = 80;
    let newton = 800;
    let mode: ElectrodeMode = "shorted";
    let ran = false;
    let live = false;
    render(
      <GlobalControls
        temperatureK={t}
        Vapp={v}
        nodesPerNm={n}
        tol={tol}
        maxGummelIter={gummel}
        maxNewtonIter={newton}
        maxRelativeResidual={rel}
        electrodeMode={mode}
        running={false}
        error={null}
        builtInVoltageV={0.7}
        liveCalc={live}
        onTemperatureChange={(next) => {
          t = next;
        }}
        onVappChange={(next) => {
          v = next;
        }}
        onNodesPerNmChange={(next) => {
          n = next;
        }}
        onTolChange={(next) => {
          tol = next;
        }}
        onMaxGummelIterChange={(next) => {
          gummel = next;
        }}
        onMaxNewtonIterChange={(next) => {
          newton = next;
        }}
        onMaxRelativeResidualChange={(next) => {
          rel = next;
        }}
        onElectrodeModeChange={(next) => {
          mode = next;
        }}
        onLiveCalcChange={(next) => {
          live = next;
        }}
        onRun={() => {
          ran = true;
        }}
      />,
    );
    expect(screen.getByText(/Vbi =/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Live$/i));
    expect(live).toBe(true);
    fireEvent.change(screen.getByLabelText(/T \[K\]/), { target: { value: "350" } });
    fireEvent.change(screen.getByLabelText(/Vapp \[V\]/), { target: { value: "0.3" } });
    fireEvent.change(screen.getByLabelText(/nodes\/nm/), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/^tol$/), { target: { value: "0.0001" } });
    fireEvent.change(screen.getByLabelText(/rel limit/), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/^Mode$/), { target: { value: "open" } });
    fireEvent.change(screen.getByLabelText(/Gummel/), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText(/Newton/), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: /Run simulation/i }));
    expect(t).toBe(350);
    expect(v).toBe(0.3);
    expect(n).toBe(3);
    expect(tol).toBe(0.0001);
    expect(rel).toBe(3);
    expect(mode).toBe("open");
    expect(gummel).toBe(120);
    expect(newton).toBe(900);
    expect(ran).toBe(true);
  });
});
