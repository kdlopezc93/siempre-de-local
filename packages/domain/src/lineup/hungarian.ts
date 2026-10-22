/**
 * Algoritmo húngaro (Kuhn–Munkres), O(n²·m), minimización: asigna cada fila a una columna
 * distinta con el menor costo total. Portado del planificador del prototipo (verificado
 * allí contra fuerza bruta). Requiere filas ≤ columnas; devuelve, por columna, la fila
 * asignada o -1.
 */
export function hungarianMin(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  const m = n === 0 ? 0 : cost[0]!.length;
  if (n === 0) return new Array<number>(m).fill(-1);
  if (n > m) throw new Error('hungarianMin: más filas que columnas');
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const p = new Array<number>(m + 1).fill(0);
  const way = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(Infinity);
    const used = new Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }
  const rowOf = new Array<number>(m).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]! > 0) rowOf[j - 1] = p[j]! - 1;
  return rowOf;
}

/**
 * Asignación para matrices de cualquier forma: si hay más filas que columnas, se resuelve
 * la traspuesta. Devuelve, por fila, la columna asignada o -1 (sobra).
 */
export function assign(cost: readonly (readonly number[])[]): number[] {
  const rows = cost.length;
  const cols = rows === 0 ? 0 : cost[0]!.length;
  const colOfRow = new Array<number>(rows).fill(-1);
  if (rows === 0 || cols === 0) return colOfRow;
  if (rows <= cols) {
    hungarianMin(cost).forEach((row, col) => {
      if (row !== -1) colOfRow[row] = col;
    });
  } else {
    const transposed = Array.from({ length: cols }, (_, c) => cost.map((r) => r[c]!));
    hungarianMin(transposed).forEach((col, row) => {
      if (col !== -1) colOfRow[row] = col;
    });
  }
  return colOfRow;
}
