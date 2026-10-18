import { useMemo } from 'react';
import { CategoryBarChart } from '../../../components/charts/CategoryBarChart';
import { groupReportResidues } from '../../../utils/report-quantities';

export function ReportResidueBreakdown({ rows, category }: { rows: readonly Record<string, unknown>[]; category: 'tipo' | 'codigo' }) {
  const breakdown = useMemo(() => groupReportResidues(rows, category), [rows, category]);
  if (breakdown.error !== undefined) return <p className="py-4 text-sm text-neutral-700">{breakdown.error}</p>;
  if (!breakdown.groups.some(group => group.items.some(item => item.value > 0))) {
    return <p className="py-4 text-sm text-neutral-600">Sin datos de residuos en esta página</p>;
  }
  return <div className="space-y-5">
    {breakdown.groups.map(group => <section key={group.unit} aria-label={`Residuos en ${group.unit}`}>
      <h4 className="mb-2 text-sm font-semibold text-neutral-800">Unidad: {group.unit}</h4>
      <CategoryBarChart data={group.items} maxItems={12} showPercent={false} valueSuffix={group.unit} />
    </section>)}
  </div>;
}
