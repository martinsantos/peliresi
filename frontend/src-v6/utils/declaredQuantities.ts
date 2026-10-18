type Quantity = { cantidad?: number; unidad?: string };
type UnitTotal = { unidad: string; cantidad: number | null };

/** No density/conversion assumptions: different declared units stay separate. */
export function declaredQuantities(rows: readonly Quantity[]): UnitTotal[] {
  const totals = new Map<string, number | null>();
  for (const row of rows) {
    const unit = row.unidad?.trim().toLocaleLowerCase('es') || 'sin unidad informada';
    const previous = totals.get(unit);
    if (previous === null || typeof row.cantidad !== 'number' || !Number.isFinite(row.cantidad) || row.cantidad < 0) {
      totals.set(unit, null);
    } else {
      const total = (previous || 0) + row.cantidad;
      totals.set(unit, Number.isFinite(total) ? total : null);
    }
  }
  return [...totals].map(([unidad, cantidad]) => ({ unidad, cantidad }));
}

export function formatDeclaredQuantity(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'Sin dato completo' : value.toLocaleString('es-AR', { maximumSignificantDigits: 12 });
}
