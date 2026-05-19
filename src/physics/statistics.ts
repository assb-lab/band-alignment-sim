/** Safe exponential for Boltzmann statistics */
export function safeExp(x: number): number {
  const clamped = Math.max(-35, Math.min(35, x));
  return Math.exp(clamped);
}

/** Carrier density from Boltzmann statistics (ni reference form). */
export function boltzmannCarrier(
  ni: number,
  deltaEv: number,
  kTEv: number,
  maxDensity?: number,
): number {
  const value = ni * safeExp(deltaEv / kTEv);
  if (maxDensity !== undefined) {
    return Math.min(value, maxDensity);
  }
  return value;
}

/** n = Nc exp(-(Ec − E_F) / kT) */
export function boltzmannElectronDensity(
  NcM3: number,
  ecEv: number,
  eFEv: number,
  kTEv: number,
): number {
  return NcM3 * safeExp(-(ecEv - eFEv) / kTEv);
}

/** p = Nv exp(-(E_F − Ev) / kT) */
export function boltzmannHoleDensity(
  NvM3: number,
  evEv: number,
  eFEv: number,
  kTEv: number,
): number {
  return NvM3 * safeExp(-(eFEv - evEv) / kTEv);
}
