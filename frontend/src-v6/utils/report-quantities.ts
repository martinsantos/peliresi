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
