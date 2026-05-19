/** Format cm⁻³-scale values for display (e.g. 2.80e+19). */
export function formatScientific(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  return value.toExponential(precision);
}

/** Parse decimal or scientific notation (e.g. 1e16, 2.8e19). */
export function parseScientific(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}
