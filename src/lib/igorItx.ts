export interface IgorWave {
  name: string;
  values: number[];
}

export interface IgorGraphSeries {
  waveName: string;
  color?: string;
  lineSize?: number;
  dashed?: boolean;
}

export interface IgorItxGraph {
  xWave: string;
  yWaves: IgorGraphSeries[];
  xLabel: string;
  yLabel: string;
}

export interface IgorItxDocument {
  waves: IgorWave[];
  graph: IgorItxGraph;
}

export function sanitizeIgorName(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = normalized || "wave";
  return /^[A-Za-z]/.test(safe) ? safe : `w_${safe}`;
}

function formatIgorNumber(value: number): string {
  if (!Number.isFinite(value)) return "NaN";
  return value.toExponential(8).replace("e", "E");
}

function quoteIgorLabel(label: string): string {
  return `"${label.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function colorToIgorRgb(color: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const hex = match[1]!;
  const parts = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((part) =>
    Math.round((Number.parseInt(part, 16) / 255) * 65535),
  );
  return `(${parts.join(",")})`;
}

export function buildIgorItx(document: IgorItxDocument): string {
  const waves = document.waves.map((wave) => ({
    ...wave,
    name: sanitizeIgorName(wave.name),
  }));
  if (waves.length === 0) {
    throw new Error("ITX export requires at least one wave");
  }

  const rowCount = waves[0]!.values.length;
  for (const wave of waves) {
    if (wave.values.length !== rowCount) {
      throw new Error("All ITX waves must have the same length");
    }
  }

  const lines = [
    "IGOR",
    `WAVES/O ${waves.map((wave) => wave.name).join(", ")}`,
    "BEGIN",
  ];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    lines.push(
      waves
        .map((wave) => formatIgorNumber(wave.values[rowIndex] ?? Number.NaN))
        .join("  "),
    );
  }

  const xWave = sanitizeIgorName(document.graph.xWave);
  const yWaves = document.graph.yWaves.map((series) => ({
    ...series,
    waveName: sanitizeIgorName(series.waveName),
  }));
  const firstSeries = yWaves[0];
  lines.push("END");
  if (firstSeries) {
    lines.push(`X Display ${firstSeries.waveName} vs ${xWave}`);
    for (const series of yWaves.slice(1)) {
      lines.push(`X AppendToGraph ${series.waveName} vs ${xWave}`);
    }
    for (const series of yWaves) {
      const options = [
        series.color ? `rgb(${series.waveName})=${colorToIgorRgb(series.color)}` : null,
        series.lineSize !== undefined ? `lsize(${series.waveName})=${series.lineSize}` : null,
        series.dashed ? `lstyle(${series.waveName})=3` : null,
      ].filter(Boolean);
      if (options.length > 0) {
        lines.push(`X ModifyGraph ${options.join(",")}`);
      }
    }
  }
  lines.push(`X Label bottom ${quoteIgorLabel(document.graph.xLabel)}`);
  lines.push(`X Label left ${quoteIgorLabel(document.graph.yLabel)}`);
  return `${lines.join("\n")}\n`;
}
