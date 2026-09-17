export type CanonicalUnit = 'kg' | 'tn' | 'lt' | 'un';

export interface QuantityLike {
  cantidad: number | string | null | undefined;
  unidad: string | null | undefined;
}

export interface QuantitySummary {
  massKg: number;
  volumeLiters: number;
  units: number;
  unknown: Record<string, number>;
}

const UNIT_ALIASES: Record<string, CanonicalUnit> = {
  kg: 'kg',
  kgs: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  tn: 'tn',
  ton: 'tn',
  tonelada: 'tn',
  toneladas: 'tn',
  t: 'tn',
  lt: 'lt',
  lts: 'lt',
  l: 'lt',
  litro: 'lt',
  litros: 'lt',
  un: 'un',
  u: 'un',
  unidad: 'un',
  unidades: 'un',
};

export function normalizeUnit(value: unknown): CanonicalUnit | null {
  if (typeof value !== 'string') return null;
  return UNIT_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function finiteNonNegative(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function finitePositive(value: unknown): number | null {
  const parsed = finiteNonNegative(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function toMassKg(value: unknown, unit: unknown): number | null {
  const amount = finiteNonNegative(value);
  const normalized = normalizeUnit(unit);
  if (amount === null || (normalized !== 'kg' && normalized !== 'tn')) return null;
  return normalized === 'tn' ? amount * 1000 : amount;
}

export function summarizeQuantities(items: QuantityLike[]): QuantitySummary {
  const summary: QuantitySummary = { massKg: 0, volumeLiters: 0, units: 0, unknown: {} };

  for (const item of items) {
    const amount = finiteNonNegative(item.cantidad);
    if (amount === null) continue;
    const unit = normalizeUnit(item.unidad);
    if (unit === 'kg') summary.massKg += amount;
    else if (unit === 'tn') summary.massKg += amount * 1000;
    else if (unit === 'lt') summary.volumeLiters += amount;
    else if (unit === 'un') summary.units += amount;
    else {
      const rawUnit = String(item.unidad ?? '').trim() || 'sin_unidad';
      summary.unknown[rawUnit] = (summary.unknown[rawUnit] ?? 0) + amount;
    }
  }

  return summary;
}

export function summaryByUnit(summary: QuantitySummary): Record<string, number> {
  const result: Record<string, number> = {};
  if (summary.massKg !== 0) result.kg = summary.massKg;
  if (summary.volumeLiters !== 0) result.lt = summary.volumeLiters;
  if (summary.units !== 0) result.un = summary.units;
  for (const [unit, amount] of Object.entries(summary.unknown)) result[unit] = amount;
  return result;
}
