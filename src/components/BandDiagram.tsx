import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import * as d3 from "d3";
import type {
  MaterialRegion,
  PreContactBandProfile,
  SimulationResult,
} from "../physics/types.ts";
import { mToNm } from "../physics/units.ts";
import {
  postContactItx,
  preContactItx,
  secondaryPlotDisplayData,
  secondaryPlotItx,
} from "../lib/plotItx.ts";

interface BandDiagramProps {
  result: SimulationResult | null;
  width?: number;
  height?: number;
}

type DragZoomMode = "x" | "y" | "xy";
type Domain = [number, number];
type YScale = d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
let clipIdCounter = 0;
let exportMenuIdCounter = 0;
const PLOT_EXPORT_MENU_EVENT = "plot-export-menu-open";
interface ZoomDomain {
  key: object;
  tab?: string;
  domain: Domain;
}
interface PlotContextMenuState {
  x: number;
  y: number;
}

function withTextHalo(
  text: d3.Selection<SVGTextElement, unknown, null, undefined>,
): d3.Selection<SVGTextElement, unknown, null, undefined> {
  text
    .attr("paint-order", "stroke")
    .attr("stroke", "white")
    .attr("stroke-width", 4)
    .attr("stroke-linejoin", "round");
  return text;
}

function addPlotClip(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  width: number,
  height: number,
): string {
  const clipId = `plot-clip-${clipIdCounter++}`;
  svg
    .append("defs")
    .append("clipPath")
    .attr("id", clipId)
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);
  return `url(#${clipId})`;
}

function ZoomControls() {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-slate-500">Drag zoom</span>
    </div>
  );
}

function useElementWidth(defaultWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [elementWidth, setElementWidth] = useState(defaultWidth);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width;
      if (nextWidth > 0) setElementWidth(nextWidth);
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, elementWidth] as const;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function serializedSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(svg.width.baseVal.value || svg.getBoundingClientRect().width));
  clone.setAttribute("height", String(svg.height.baseVal.value || svg.getBoundingClientRect().height));
  return new XMLSerializer().serializeToString(clone);
}

function downloadSvg(svg: SVGSVGElement, filename: string) {
  triggerDownload(new Blob([serializedSvg(svg)], { type: "image/svg+xml;charset=utf-8" }), filename);
}

function downloadItx(itx: string, filename: string) {
  triggerDownload(new Blob([itx], { type: "text/plain;charset=utf-8" }), filename);
}

function downloadPng(svg: SVGSVGElement, filename: string) {
  const svgBlob = new Blob([serializedSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  const width = Math.max(1, Math.round(svg.width.baseVal.value || svg.getBoundingClientRect().width));
  const height = Math.max(1, Math.round(svg.height.baseVal.value || svg.getBoundingClientRect().height));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      URL.revokeObjectURL(url);
      if (blob) triggerDownload(blob, filename);
    }, "image/png");
  };
  image.src = url;
}

function usePlotExportMenu(
  svgRef: RefObject<SVGSVGElement | null>,
  filenameBase: string,
  getItx?: () => string | null,
) {
  const [menu, setMenu] = useState<PlotContextMenuState | null>(null);
  const menuId = useRef(`plot-export-menu-${exportMenuIdCounter++}`);

  useEffect(() => {
    const closeOtherMenu = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail === menuId.current) return;
      setMenu(null);
    };
    window.addEventListener(PLOT_EXPORT_MENU_EVENT, closeOtherMenu);
    return () => window.removeEventListener(PLOT_EXPORT_MENU_EVENT, closeOtherMenu);
  }, []);

  const openMenu = (event: ReactMouseEvent<SVGSVGElement>) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent(PLOT_EXPORT_MENU_EVENT, { detail: menuId.current }));
    setMenu({ x: event.clientX, y: event.clientY });
  };
  const closeMenu = () => setMenu(null);
  const exportSvg = () => {
    if (svgRef.current) downloadSvg(svgRef.current, `${filenameBase}.svg`);
    closeMenu();
  };
  const exportPng = () => {
    if (svgRef.current) downloadPng(svgRef.current, `${filenameBase}.png`);
    closeMenu();
  };
  const exportItx = () => {
    const itx = getItx?.();
    if (itx) downloadItx(itx, `${filenameBase}.itx`);
    closeMenu();
  };
  return { menu, openMenu, closeMenu, exportSvg, exportPng, exportItx };
}

function PlotContextMenu({
  menu,
  onExportSvg,
  onExportPng,
  onExportItx,
  onClose,
}: {
  menu: PlotContextMenuState | null;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportItx: () => void;
  onClose: () => void;
}) {
  if (!menu) return null;
  return (
    <div
      className="fixed z-50 min-w-32 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onMouseLeave={onClose}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100"
        onClick={onExportSvg}
      >
        Export SVG
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100"
        onClick={onExportPng}
      >
        Export PNG
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100"
        onClick={onExportItx}
      >
        Export ITX
      </button>
    </div>
  );
}


function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function inferDragZoomMode(deltaX: number, deltaY: number): DragZoomMode | undefined {
  if (deltaX < 8 && deltaY < 8) return undefined;
  if (deltaX > deltaY * 3) return "x";
  if (deltaY > deltaX * 3) return "y";
  return "xy";
}

function selectionRectForDrag(
  start: [number, number],
  current: [number, number],
  innerW: number,
  innerH: number,
): { x: number; y: number; width: number; height: number } | null {
  const x0 = Math.min(start[0], current[0]);
  const x1 = Math.max(start[0], current[0]);
  const y0 = Math.min(start[1], current[1]);
  const y1 = Math.max(start[1], current[1]);
  const mode = inferDragZoomMode(x1 - x0, y1 - y0);
  if (!mode) return null;
  return {
    x: mode === "y" ? 0 : x0,
    y: mode === "x" ? 0 : y0,
    width: mode === "y" ? innerW : Math.max(1, x1 - x0),
    height: mode === "x" ? innerH : Math.max(1, y1 - y0),
  };
}

function zoomDomainAt(domain: Domain, anchor: number, factor: number): Domain {
  return [anchor + (domain[0] - anchor) * factor, anchor + (domain[1] - anchor) * factor];
}

function panDomain(domain: Domain, delta: number): Domain {
  return [domain[0] + delta, domain[1] + delta];
}

function localPointer(event: PointerEvent | WheelEvent, target: Element): [number, number] {
  try {
    return d3.pointer(event, target) as [number, number];
  } catch {
    const rect = target.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }
}

function isHorizontalWheel(event: WheelEvent): boolean {
  return Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2;
}

function installDragZoom(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerW: number,
  innerH: number,
  x: d3.ScaleLinear<number, number>,
  y: YScale,
  setXDomain: (domain: Domain | null) => void,
  setYDomain: (domain: Domain | null) => void,
) {
  let start: [number, number] | null = null;
  let current: [number, number] | null = null;
  let panStart: [number, number] | null = null;
  let panXDomain: Domain | null = null;
  let panYDomain: Domain | null = null;
  let nextPanXDomain: Domain | null = null;
  let nextPanYDomain: Domain | null = null;
  let removePanListeners: (() => void) | null = null;
  const selection = g
    .append("rect")
    .attr("display", "none")
    .attr("fill", "#2563eb")
    .attr("fill-opacity", 0.14)
    .attr("stroke", "#2563eb")
    .attr("stroke-width", 1)
    .style("pointer-events", "none");

  const updateSelection = () => {
    if (!start || !current) return;
    const rect = selectionRectForDrag(start, current, innerW, innerH);
    if (!rect) {
      selection.attr("display", "none");
      return;
    }
    selection
      .attr("display", null)
      .attr("x", rect.x)
      .attr("y", rect.y)
      .attr("width", rect.width)
      .attr("height", rect.height);
  };
  const resetPan = () => {
    removePanListeners?.();
    removePanListeners = null;
    panStart = null;
    panXDomain = null;
    panYDomain = null;
    nextPanXDomain = null;
    nextPanYDomain = null;
    interaction.style("cursor", "crosshair");
  };
  const updatePan = (clientX: number, clientY: number, rect: DOMRect) => {
    if (!panStart || !panXDomain || !panYDomain) return;
    const currentPan: [number, number] = [
      clamp(clientX - rect.left, 0, innerW),
      clamp(clientY - rect.top, 0, innerH),
    ];
    const xDelta = x.invert(panStart[0]) - x.invert(currentPan[0]);
    const yDelta = y.invert(panStart[1]) - y.invert(currentPan[1]);
    nextPanXDomain = panDomain(panXDomain, xDelta);
    nextPanYDomain = panDomain(panYDomain, yDelta);
    setXDomain(nextPanXDomain);
    setYDomain(nextPanYDomain);
  };

  const interaction = g
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .style("cursor", "crosshair");

  interaction
    .on("wheel", function (event: WheelEvent) {
      if (event.metaKey || event.ctrlKey) return;
      const [rawX, rawY] = localPointer(event, this);
      const px = clamp(rawX, 0, innerW);
      const py = clamp(rawY, 0, innerH);
      const xDomain = x.domain() as Domain;
      const yDomain = y.domain() as Domain;
      const horizontalWheel = isHorizontalWheel(event);

      if (event.altKey && (event.shiftKey || horizontalWheel)) {
        const deltaSource = event.deltaY || event.deltaX;
        const delta = deltaSource * (xDomain[1] - xDomain[0]) * 0.001;
        setXDomain(panDomain(xDomain, delta));
      } else if (event.altKey) {
        const delta = event.deltaY * (yDomain[1] - yDomain[0]) * 0.001;
        setYDomain(panDomain(yDomain, delta));
      } else if (event.shiftKey || horizontalWheel) {
        const deltaSource = event.deltaY || event.deltaX;
        setXDomain(zoomDomainAt(xDomain, x.invert(px), Math.exp(deltaSource * 0.001)));
      } else {
        setYDomain(zoomDomainAt(yDomain, y.invert(py), Math.exp(event.deltaY * 0.001)));
      }
      event.preventDefault();
      event.stopPropagation();
    })
    .on("dblclick", function (event: PointerEvent) {
      selection.attr("display", "none");
      start = null;
      current = null;
      panStart = null;
      setXDomain(null);
      setYDomain(null);
      event.preventDefault();
    })
    .on("pointerdown", function (event: PointerEvent) {
      const [px, py] = localPointer(event, this);
      (this as SVGRectElement).setPointerCapture?.(event.pointerId);
      if (event.altKey) {
        panStart = [clamp(px, 0, innerW), clamp(py, 0, innerH)];
        panXDomain = x.domain() as Domain;
        panYDomain = y.domain() as Domain;
        nextPanXDomain = panXDomain;
        nextPanYDomain = panYDomain;
        selection.attr("display", "none");
        interaction.style("cursor", "grab");
        const targetRect = (this as SVGRectElement).getBoundingClientRect();
        const onWindowMove = (moveEvent: PointerEvent) => {
          updatePan(moveEvent.clientX, moveEvent.clientY, targetRect);
          moveEvent.preventDefault();
        };
        const onWindowUp = (upEvent: PointerEvent) => {
          updatePan(upEvent.clientX, upEvent.clientY, targetRect);
          resetPan();
          upEvent.preventDefault();
        };
        window.addEventListener("pointermove", onWindowMove);
        window.addEventListener("pointerup", onWindowUp, { once: true });
        window.addEventListener("pointercancel", onWindowUp, { once: true });
        removePanListeners = () => {
          window.removeEventListener("pointermove", onWindowMove);
          window.removeEventListener("pointerup", onWindowUp);
          window.removeEventListener("pointercancel", onWindowUp);
        };
      } else {
        start = [clamp(px, 0, innerW), clamp(py, 0, innerH)];
        current = start;
        updateSelection();
      }
      event.preventDefault();
    })
    .on("pointermove", function (event: PointerEvent) {
      if (panStart && panXDomain && panYDomain) {
        updatePan(event.clientX, event.clientY, (this as SVGRectElement).getBoundingClientRect());
        event.preventDefault();
        return;
      }
      if (!start) return;
      const [px, py] = localPointer(event, this);
      current = [clamp(px, 0, innerW), clamp(py, 0, innerH)];
      updateSelection();
      event.preventDefault();
    })
    .on("pointerup pointercancel", function (event: PointerEvent) {
      if (panStart) {
        updatePan(event.clientX, event.clientY, (this as SVGRectElement).getBoundingClientRect());
        resetPan();
        event.preventDefault();
        return;
      }
      if (!start || !current) return;
      const x0 = Math.min(start[0], current[0]);
      const x1 = Math.max(start[0], current[0]);
      const y0 = Math.min(start[1], current[1]);
      const y1 = Math.max(start[1], current[1]);
      const mode = inferDragZoomMode(x1 - x0, y1 - y0);
      selection.attr("display", "none");
      start = null;
      current = null;
      if ((mode === "x" || mode === "xy")) {
        setXDomain([x.invert(x0), x.invert(x1)]);
      }
      if ((mode === "y" || mode === "xy")) {
        setYDomain([y.invert(y1), y.invert(y0)]);
      }
      event.preventDefault();
    });
}

export function BandDiagram({ result, width = 920, height = 420 }: BandDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerRef, drawWidth] = useElementWidth(width);
  const [xZoom, setXZoom] = useState<ZoomDomain | null>(null);
  const [yZoom, setYZoom] = useState<ZoomDomain | null>(null);
  const exportMenu = usePlotExportMenu(
    svgRef,
    "band-diagram",
    () => (result ? postContactItx(result) : null),
  );

  useLayoutEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!result) {
      svg
        .append("text")
        .attr("x", drawWidth / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .text("Run simulation to view band diagram");
      return;
    }

    const margin = { top: 28, right: 20, bottom: 50, left: 60 };
    const innerW = drawWidth - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const plotClipUrl = addPlotClip(svg, innerW, innerH);
    const plotG = g.append("g").attr("clip-path", plotClipUrl);

    const xData = Array.from(result.bands.xM ?? result.mesh.nodes.map((n) => n.xM)).map((xM) =>
      mToNm(xM),
    );
    const isMetalPoint = (index: number) => result.bands.layerKind?.[index] === "metal";
    const semiconductorValues = (values: Float64Array) =>
      Array.from(values, (value, index) => (isMetalPoint(index) ? Number.NaN : value));
    const efValues = semiconductorValues(result.bands.efnEv);
    const metalEfValues = Array.from(result.bands.efnEv, (value, index) =>
      isMetalPoint(index) ? value : Number.NaN,
    );
    const series = [
      { key: "Ec", values: Array.from(result.bands.ecEv), color: "#ef0000", labelDy: "-0.55em" },
      { key: "Ev", values: Array.from(result.bands.evEv), color: "#1747ff", labelDy: "1.05em" },
      {
        key: "EF",
        values: efValues,
        color: "#111827",
        labelDy: "-0.55em",
        dashed: true,
      },
      {
        key: "EF",
        values: metalEfValues,
        color: "#111827",
        labelDy: "-0.55em",
        dataRole: "metal-ef",
        labelAtLastPoint: true,
      },
    ];

    const yAll = series.flatMap((s) => Array.from(s.values).filter(Number.isFinite));
    const baseXDomain: Domain = [0, d3.max(xData) ?? 1];
    const activeXDomain = xZoom?.key === result ? xZoom.domain : null;
    const activeYDomain = yZoom?.key === result ? yZoom.domain : null;
    const x = d3.scaleLinear().domain(activeXDomain ?? baseXDomain).range([0, innerW]);
    const yPad = 0.05;
    const baseYDomain: Domain = [d3.min(yAll)! - yPad, d3.max(yAll)! + yPad];
    const y = d3
      .scaleLinear()
      .domain(activeYDomain ?? baseYDomain)
      .range([innerH, 0]);

    g.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .attr("fill", "#334155")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text(
        Math.abs(result.appliedVoltageV) > 1e-12
          ? `Biased band diagram (Vapp=${result.appliedVoltageV.toFixed(3)} V)`
          : "Equilibrium band diagram",
      );

    result.materialRegions.forEach((region, i) => {
      const x0 = x(mToNm(region.xStartM));
      const x1 = x(mToNm(region.xEndM));
      if (i > 0) {
        plotG
          .append("line")
          .attr("x1", x0)
          .attr("x2", x0)
          .attr("y1", 0)
          .attr("y2", innerH)
          .attr("stroke", "#475569")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4 4")
          .attr("opacity", 0.75);
      }

      withTextHalo(
        g
          .append("text")
          .attr("x", (x0 + x1) / 2)
          .attr("y", 8)
          .attr("text-anchor", "middle")
          .attr("fill", "#0f172a")
          .attr("font-size", 12)
          .attr("font-weight", 600)
          .text(region.label),
      );
    });

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickSizeInner(-6).tickSizeOuter(0))
      .call((sel) => sel.selectAll("text").attr("fill", "#334155"))
      .call((sel) => sel.selectAll("line,path").attr("stroke", "#64748b"));

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .text("Position [nm]");

    g.append("g")
      .call(d3.axisLeft(y).ticks(8).tickSizeInner(-6).tickSizeOuter(0))
      .call((sel) => sel.selectAll("text").attr("fill", "#334155"))
      .call((sel) => sel.selectAll("line,path").attr("stroke", "#64748b"));

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -48)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .text("Energy [eV]");

    const line = d3
      .line<number>()
      .x((_, i) => x(xData[i]!))
      .y((d) => y(d))
      .defined((d) => Number.isFinite(d));

    for (const s of series) {
      const finiteValues = s.values.filter(Number.isFinite);
      if (finiteValues.length === 0) continue;
      plotG
        .append("path")
        .datum(s.values)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", s.dashed ? 1.5 : 2)
        .attr("stroke-dasharray", s.dashed ? "4 3" : null)
        .attr("data-role", s.dataRole ?? null)
        .attr("d", line);

      const lastFiniteIndex = s.values.findLastIndex(Number.isFinite);
      const labelX = s.labelAtLastPoint ? clamp(x(xData[lastFiniteIndex]!), 4, innerW - 4) : innerW - 4;
      const labelY = clamp(y(s.values[lastFiniteIndex] ?? 0), 12, innerH - 12);
      withTextHalo(
        plotG
          .append("text")
          .attr("x", labelX)
          .attr("y", labelY)
          .attr("dy", s.labelDy)
          .attr("text-anchor", "end")
          .attr("fill", s.color)
          .attr("font-size", 11)
          .text(s.key),
      );
    }

    installDragZoom(
      g,
      innerW,
      innerH,
      x,
      y,
      (domain) => setXZoom(domain && result ? { key: result, domain } : null),
      (domain) => setYZoom(domain && result ? { key: result, domain } : null),
    );
  }, [result, drawWidth, height, xZoom, yZoom]);

  return (
    <div ref={containerRef} className="relative w-full">
      <ZoomControls />
      <svg
        ref={svgRef}
        width={drawWidth}
        height={height}
        className="w-full max-w-full rounded-lg border border-slate-200 bg-white"
        role="img"
        aria-label="Band diagram"
        onContextMenu={exportMenu.openMenu}
      />
      <PlotContextMenu
        menu={exportMenu.menu}
        onExportSvg={exportMenu.exportSvg}
        onExportPng={exportMenu.exportPng}
        onExportItx={exportMenu.exportItx}
        onClose={exportMenu.closeMenu}
      />
    </div>
  );
}

export interface PreContactDiagramData {
  bands: PreContactBandProfile;
  regions: MaterialRegion[];
}

interface PreContactBandDiagramProps {
  preview: PreContactDiagramData | null;
  width?: number;
  height?: number;
}
type PreContactWidthMode = "equal" | "physical";
const PRECONTACT_EQUAL_BAND_WIDTH = 194;
const PRECONTACT_EQUAL_GAP = 28;

function labelYAboveOrBelow(
  lineY: number,
  preferredOffset: number,
  conflictingY?: number,
): number {
  const preferredY = lineY - preferredOffset;
  if (preferredY < 14 || (conflictingY !== undefined && Math.abs(preferredY - conflictingY) < 14)) {
    return lineY + 16;
  }
  return preferredY;
}

function preContactBandSpan(
  x0: number,
  x1: number,
  widthMode: PreContactWidthMode,
): { x0: number; x1: number } {
  if (widthMode === "equal") {
    return { x0, x1 };
  }
  const regionWidth = Math.max(0, x1 - x0);
  const leftPadding = Math.min(14, Math.max(4, regionWidth * 0.04));
  const currentUsableWidth = Math.max(1, regionWidth - leftPadding * 2);
  const bandWidth = Math.max(1, currentUsableWidth * 0.5);
  const bx0 = x0 + leftPadding;
  return { x0: bx0, x1: Math.min(x1 - 4, bx0 + bandWidth) };
}

function appendEfText(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: number,
  y: number,
  valueEv: number,
) {
  const text = g
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("fill", "#111827")
    .attr("font-size", 13);
  text.append("tspan").text("E");
  text.append("tspan").attr("baseline-shift", "sub").attr("font-size", 10).text("F");
  text.append("tspan").text(`=${valueEv.toFixed(2)} eV`);
  return text;
}

export function PreContactBandDiagram({
  preview,
  width = 920,
  height = 300,
}: PreContactBandDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerRef, drawWidth] = useElementWidth(width);
  const [widthMode, setWidthMode] = useState<PreContactWidthMode>("equal");
  const [xZoom, setXZoom] = useState<ZoomDomain | null>(null);
  const [yZoom, setYZoom] = useState<ZoomDomain | null>(null);
  const exportMenu = usePlotExportMenu(
    svgRef,
    "pre-contact-band-diagram",
    () => (preview ? preContactItx(preview) : null),
  );

  useLayoutEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!preview) {
      svg
        .append("text")
        .attr("x", drawWidth / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .text("Add layers to view vacuum reference bands");
      return;
    }

    const margin = { top: 26, right: 20, bottom: 46, left: 68 };
    const innerW = drawWidth - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const displayRegions =
      widthMode === "equal"
        ? preview.regions.map((region, i) => {
            const xStartM = i * (PRECONTACT_EQUAL_BAND_WIDTH + PRECONTACT_EQUAL_GAP);
            return {
              ...region,
              xStartM,
              xEndM: xStartM + PRECONTACT_EQUAL_BAND_WIDTH,
            };
          })
        : preview.regions;
    const xData =
      widthMode === "equal"
        ? [
            0,
            displayRegions.at(-1)?.xEndM ?? PRECONTACT_EQUAL_BAND_WIDTH,
            drawWidth - margin.left - margin.right,
          ]
        : Array.from(preview.bands.xM).map((xM) => mToNm(xM));
    const ec0 = Array.from(preview.bands.ecEv);
    const ev0 = Array.from(preview.bands.evEv);
    const ef0 = Array.from(preview.bands.efEv);
    const yAll = [
      0,
      ...ec0.filter(Number.isFinite),
      ...ev0.filter(Number.isFinite),
      ...ef0.filter(Number.isFinite),
    ];
    const baseXDomain: Domain = [0, d3.max(xData) ?? 1];
    const zoomKey = preview;
    const activeXDomain = xZoom?.key === zoomKey && xZoom.tab === widthMode ? xZoom.domain : null;
    const activeYDomain = yZoom?.key === zoomKey && yZoom.tab === widthMode ? yZoom.domain : null;
    const x = d3.scaleLinear().domain(activeXDomain ?? baseXDomain).range([0, innerW]);
    const baseYDomain: Domain = [d3.min(yAll)! - 0.35, 0.45];
    const y = d3
      .scaleLinear()
      .domain(activeYDomain ?? baseYDomain)
      .range([innerH, 0]);

    svg
      .append("defs")
      .append("marker")
      .attr("id", "precontact-arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 8)
      .attr("refY", 5)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "currentColor");

    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#111827")
      .attr("stroke-width", 2);
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", y(0) - 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#111827")
      .attr("font-size", 18)
      .attr("font-weight", 700)
      .text("Vacuum level");

    g.append("line")
      .attr("x1", -22)
      .attr("x2", -22)
      .attr("y1", Math.max(0, y(0) - 28))
      .attr("y2", innerH - 8)
      .attr("stroke", "#111827")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#precontact-arrow)");
    g.append("text")
      .attr("x", -22)
      .attr("y", innerH + 24)
      .attr("text-anchor", "middle")
      .attr("fill", "#111827")
      .attr("font-size", 18)
      .attr("font-style", "italic")
      .text("E / eV");

    const semRegions = displayRegions.filter(
      (_, i) => preview.bands.layerKind[i * 2] !== "metal",
    );

    displayRegions.forEach((region, i) => {
      if (preview.bands.layerKind[i * 2] !== "metal") return;
      const x0 = x(widthMode === "equal" ? region.xStartM : mToNm(region.xStartM));
      const x1 = x(widthMode === "equal" ? region.xEndM : mToNm(region.xEndM));
      const sampleIndex = i * 2;
      const ef = ef0[sampleIndex]!;
      const { x0: bx0, x1: bx1 } = preContactBandSpan(x0, x1, widthMode);
      const cx = (bx0 + bx1) / 2;

      g.append("line")
        .attr("x1", bx0)
        .attr("x2", bx1)
        .attr("y1", y(ef))
        .attr("y2", y(ef))
        .attr("stroke", "#111827")
        .attr("stroke-width", 2)
        .attr("data-role", "metal-ef");
      appendEfText(g, bx0, labelYAboveOrBelow(y(ef), 6), -ef);
      g.append("text")
        .attr("x", cx)
        .attr("y", innerH + 26)
        .attr("text-anchor", "middle")
        .attr("fill", "#0f172a")
        .attr("font-size", 16)
        .attr("font-weight", 500)
        .text(region.label);
    });

    semRegions.forEach((region) => {
      const sampleIndex = displayRegions.indexOf(region) * 2;
      const layerKind = preview.bands.layerKind[sampleIndex];
      if (layerKind === "metal") return;
      const x0 = x(widthMode === "equal" ? region.xStartM : mToNm(region.xStartM));
      const x1 = x(widthMode === "equal" ? region.xEndM : mToNm(region.xEndM));
      const ec = ec0[sampleIndex]!;
      const ev = ev0[sampleIndex]!;
      const ef = ef0[sampleIndex]!;
      const { x0: bx0, x1: bx1 } = preContactBandSpan(x0, x1, widthMode);
      const cx = (bx0 + bx1) / 2;

      g.append("line")
        .attr("x1", bx0)
        .attr("x2", bx1)
        .attr("y1", y(ec))
        .attr("y2", y(ec))
        .attr("stroke", "#ef0000")
        .attr("stroke-width", 2);
      g.append("line")
        .attr("x1", bx0)
        .attr("x2", bx1)
        .attr("y1", y(ev))
        .attr("y2", y(ev))
        .attr("stroke", "#1747ff")
        .attr("stroke-width", 2);
      g.append("line")
        .attr("x1", bx0)
        .attr("x2", bx1)
        .attr("y1", y(ef))
        .attr("y2", y(ef))
        .attr("stroke", "#111827")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5 3");

      g.append("text")
        .attr("x", bx0)
        .attr("y", y(ec) - 8)
        .attr("fill", "#111827")
        .attr("font-size", 13)
        .text(`EA= ${(-ec).toFixed(2)} eV`);
      g.append("text")
        .attr("x", bx0)
        .attr("y", y(ev) + 16)
        .attr("fill", "#111827")
        .attr("font-size", 13)
        .text(`IP= ${(-ev).toFixed(2)} eV`);
      appendEfText(g, bx0, labelYAboveOrBelow(y(ef), 6, y(ec) - 8), -ef);
      g.append("text")
        .attr("x", cx)
        .attr("y", innerH + 26)
        .attr("text-anchor", "middle")
        .attr("fill", "#0f172a")
        .attr("font-size", 16)
        .attr("font-weight", 500)
        .text(region.label);
    });

    installDragZoom(
      g,
      innerW,
      innerH,
      x,
      y,
      (domain) => setXZoom(domain && preview ? { key: zoomKey, tab: widthMode, domain } : null),
      (domain) => setYZoom(domain && preview ? { key: zoomKey, tab: widthMode, domain } : null),
    );
  }, [preview, drawWidth, height, widthMode, xZoom, yZoom]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <ZoomControls />
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Width</span>
          {(
            [
              ["equal", "Equal"],
              ["physical", "Thickness"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`rounded px-2 py-0.5 ${widthMode === mode ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
              onClick={() => {
                setWidthMode(mode);
                setXZoom(null);
                setYZoom(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svgRef}
        width={drawWidth}
        height={height}
        className="w-full max-w-full rounded-lg border border-slate-200 bg-white"
        role="img"
        aria-label="Pre-contact vacuum reference band diagram"
        onContextMenu={exportMenu.openMenu}
      />
      <PlotContextMenu
        menu={exportMenu.menu}
        onExportSvg={exportMenu.exportSvg}
        onExportPng={exportMenu.exportPng}
        onExportItx={exportMenu.exportItx}
        onClose={exportMenu.closeMenu}
      />
    </div>
  );
}

export type SecondaryPlotTab = "phi" | "field" | "carriers" | "rho";

interface SecondaryPlotsProps {
  result: SimulationResult | null;
  tab: SecondaryPlotTab;
  width?: number;
  height?: number;
}

export function SecondaryPlots({
  result,
  tab,
  width = 920,
  height = 240,
}: SecondaryPlotsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerRef, drawWidth] = useElementWidth(width);
  const [xZoom, setXZoom] = useState<ZoomDomain | null>(null);
  const [yZoom, setYZoom] = useState<ZoomDomain | null>(null);
  const exportMenu = usePlotExportMenu(
    svgRef,
    `${tab}-plot`,
    () => (result ? secondaryPlotItx(result, tab) : null),
  );

  useLayoutEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!result) return;

    const margin = { top: 16, right: 16, bottom: 50, left: 64 };
    const innerW = drawWidth - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const plotClipUrl = addPlotClip(svg, innerW, innerH);
    const plotG = g.append("g").attr("clip-path", plotClipUrl);

    const { xNm: xData, values: yData, yLabel, logScale } = secondaryPlotDisplayData(result, tab);
    const baseXDomain: Domain = [0, d3.max(xData) ?? 1];
    const activeXDomain =
      xZoom?.key === result && xZoom.tab === tab ? xZoom.domain : null;
    const activeYDomain =
      yZoom?.key === result && yZoom.tab === tab ? yZoom.domain : null;
    const x = d3.scaleLinear().domain(activeXDomain ?? baseXDomain).range([0, innerW]);

    const finiteYData = yData.filter((v) => Number.isFinite(v));
    const positiveYData = finiteYData.filter((v) => v > 0);
    const baseYDomain: Domain = logScale
      ? [d3.min(positiveYData) ?? 1, d3.max(positiveYData) ?? 1]
      : [d3.min(finiteYData) ?? 0, d3.max(finiteYData) ?? 1];
    const effectiveYDomain: Domain = logScale
      ? [
          Math.max(activeYDomain?.[0] ?? baseYDomain[0], 1e-30),
          Math.max(activeYDomain?.[1] ?? baseYDomain[1], 1e-30),
        ]
      : activeYDomain ?? baseYDomain;
    const y = logScale
      ? d3.scaleLog().domain(effectiveYDomain).range([innerH, 0])
      : d3.scaleLinear().domain(effectiveYDomain).range([innerH, 0]);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickSizeInner(-6).tickSizeOuter(0))
      .call((sel) => sel.selectAll("text").attr("fill", "#334155"))
      .call((sel) => sel.selectAll("line,path").attr("stroke", "#64748b"));

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .text("Position [nm]");

    const yAxis = d3
      .axisLeft(y)
      .ticks(6, logScale ? "~s" : tab === "phi" ? ".1e" : undefined)
      .tickSizeInner(-6)
      .tickSizeOuter(0);

    g.append("g")
      .call(yAxis)
      .call((sel) => sel.selectAll("text").attr("fill", "#334155"))
      .call((sel) => sel.selectAll("line,path").attr("stroke", "#64748b"));

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -52)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .text(yLabel);

    const line = d3
      .line<number>()
      .x((_, i) => x(xData[i]!))
      .y((d) => y(Math.max(d, logScale ? 1 : d)))
      .defined((d) => Number.isFinite(d) && (!logScale || d > 0));

    plotG
      .append("path")
      .datum(yData)
      .attr("fill", "none")
      .attr("stroke", "#4f46e5")
      .attr("stroke-width", 2)
      .attr("d", line);

    installDragZoom(
      g,
      innerW,
      innerH,
      x,
      y,
      (domain) => setXZoom(domain && result ? { key: result, tab, domain } : null),
      (domain) => setYZoom(domain && result ? { key: result, tab, domain } : null),
    );
  }, [result, tab, drawWidth, height, xZoom, yZoom]);

  return (
    <div ref={containerRef} className="relative w-full">
      <ZoomControls />
      <svg
        ref={svgRef}
        width={drawWidth}
        height={height}
        className="w-full max-w-full rounded-lg border border-slate-200 bg-white"
        onContextMenu={exportMenu.openMenu}
      />
      <PlotContextMenu
        menu={exportMenu.menu}
        onExportSvg={exportMenu.exportSvg}
        onExportPng={exportMenu.exportPng}
        onExportItx={exportMenu.exportItx}
        onClose={exportMenu.closeMenu}
      />
    </div>
  );
}
