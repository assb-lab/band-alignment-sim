/** eV to joules */
export function eVToJ(eV: number): number {
  return eV * 1.602_176_634e-19;
}

/** J to eV */
export function jToEv(j: number): number {
  return j / 1.602_176_634e-19;
}

/** cm to m */
export function cmToM(cm: number): number {
  return cm * 1e-2;
}

/** m to nm */
export function mToNm(m: number): number {
  return m * 1e9;
}

/** nm to m */
export function nmToM(nm: number): number {
  return nm * 1e-9;
}

/** cm^-3 to m^-3 */
export function perCm3ToPerM3(n: number): number {
  return n * 1e6;
}

/** m^-3 to cm^-3 */
export function perM3ToPerCm3(n: number): number {
  return n * 1e-6;
}
