/** Quantities from the displayed report page, grouped by their actual unit.
 * No mass conversion or addition across incompatible units is implied. */
export function formatReportQuantities(rows: readonly Record<string, unknown>[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.residuos == null) continue;
    if (!Array.isArray(row.residuos)) return 'Cantidad no disponible';
    for (const residue of row.residuos) {
      if (!residue || typeof residue !== 'object') return 'Cantidad no disponible';
      const amount = typeof residue.cantidad === 'number' ? residue.cantidad
        : typeof residue.cantidad === 'string' && residue.cantidad.trim() ? Number(residue.cantidad) : NaN;
      if (!Number.isFinite(amount)) return 'Cantidad no disponible';
      const unit = typeof residue.unidad === 'string' && residue.unidad.trim() ? residue.unidad.trim() : 'sin unidad';
      totals.set(unit, (totals.get(unit) || 0) + amount);
    }
  }
  return [...totals].map(([unit, amount]) => `${amount.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${unit}`).join(' · ') || '0';
}

export type ResidueUnitGroup = { unit: string; items: { name: string; value: number }[] };
/** Lossy server aggregates cannot establish comparable quantities. Use the
 * actual page records, and never compare masses with volumes or missing units. */
export function groupReportResidues(rows: readonly Record<string, unknown>[], category: 'tipo' | 'codigo'):
  { groups: ResidueUnitGroup[]; error?: undefined } | { groups?: undefined; error: string } {
  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.residuos == null) continue;
    if (!Array.isArray(row.residuos)) return { error: 'Hay cantidades inválidas; no se muestra una suma parcial.' };
    for (const residue of row.residuos) {
      if (!residue || typeof residue !== 'object') return { error: 'Hay cantidades inválidas; no se muestra una suma parcial.' };
      const amount = typeof residue.cantidad === 'number' ? residue.cantidad
        : typeof residue.cantidad === 'string' && residue.cantidad.trim() ? Number(residue.cantidad) : NaN;
      if (!Number.isFinite(amount) || amount < 0) return { error: 'Hay cantidades inválidas; no se muestra una suma parcial.' };
      const unit = typeof residue.unidad === 'string' ? residue.unidad.trim() : '';
      if (!unit) return { error: 'Falta la unidad de un residuo; no se puede comparar su cantidad.' };
      const name = typeof residue[category] === 'string' && residue[category].trim() ? residue[category].trim() : 'Sin clasificación';
      let values = groups.get(unit);
      if (!values) { values = new Map(); groups.set(unit, values); }
      const total = (values.get(name) || 0) + amount;
      if (!Number.isFinite(total)) return { error: 'Hay cantidades inválidas; no se muestra una suma parcial.' };
      values.set(name, total);
    }
  }
  return { groups: [...groups].map(([unit, values]) => ({ unit, items: [...values].map(([name, value]) => ({ name, value })) })) };
}
