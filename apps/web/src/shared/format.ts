/**
 * Porcentaje para mostrar: entero y con espacio duro antes del %, como se escribe en Colombia
 * (design-system §4): 0.82 → "82 %".
 */
export const percent = (fraction: number) => `${Math.round(fraction * 100)}\u00a0%`;
