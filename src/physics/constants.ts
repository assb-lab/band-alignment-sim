/** Elementary charge [C] */
export const Q = 1.602_176_634e-19;

/** Boltzmann constant [J/K] */
export const KB = 1.380_649e-23;

/** Vacuum permittivity [F/m] */
export const EPS0 = 8.854_187_8128e-12;

/** Thermal voltage at temperature T [V] */
export function thermalVoltage(temperatureK: number): number {
  return (KB * temperatureK) / Q;
}
