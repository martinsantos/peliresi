/**
 * CategoryBarChart — horizontal bar chart replacement for pie/donut charts
 * Handles text-heavy categories gracefully: labels are placed outside bars,
 * values shown as count + percentage, and rows are sorted by value.
 */
import React, { useMemo } from 'react';

export interface CategoryBarItem {
  name: string;       // short label (may be truncated)
  fullName?: string;  // full label for tooltip
  value: number;
  fill?: string;
}

interface CategoryBarChartProps {
  data: CategoryBarItem[];
  maxItems?: number;           // show top N, group rest as "Otros"
  emptyMessage?: string;
  showPercent?: boolean;
  valueSuffix?: string;        // e.g. 'kg', 'manifiestos'
  defaultColor?: string;
  height?: number | string;    // container height
}

const DEFAULT_COLORS = [
  '#0D8A4F', '#1B5E3C', '#C4A000', '#8B4513', '#6B7280',
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981',
  '#EF4444', '#14B8A6', '#A855F7', '#F59E0B', '#06B6D4',
];

export const CategoryBarChart: React.FC<CategoryBarChartProps> = ({
  data,
  maxItems = 10,
  emptyMessage = 'Sin datos',
  showPercent = true,
  valueSuffix = '',
  defaultColor,
  height = 'auto',
}) => {
  const { items, total, max } = useMemo(() => {
    const sorted = [...data].filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, d) => sum + d.value, 0);

    // Group tail into "Otros" if exceeds maxItems
    let display = sorted;
    if (sorted.length > maxItems) {
      const top = sorted.slice(0, maxItems - 1);
      const rest = sorted.slice(maxItems - 1);
      const restTotal = rest.reduce((s, d) => s + d.value, 0);
      display = [
        ...top,
        { name: `Otros (${rest.length})`, fullName: rest.map(r => r.fullName || r.name).join(', '), value: restTotal },
      ];
    }

    const max = display.length > 0 ? display[0].value : 0;
    return { items: display, total, max };
  }, [data, maxItems]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-neutral-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-1.5" style={{ maxHeight: height === 'auto' ? undefined : height, overflowY: height === 'auto' ? undefined : 'auto' }}>
      {items.map((item, idx) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const barWidth = max > 0 ? (item.value / max) * 100 : 0;
        const color = item.fill || defaultColor || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

        return (
          <div key={`${item.name}-${idx}`} className="group" title={item.fullName || item.name}>
            {/* Label row */}
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-xs font-medium text-neutral-700 truncate flex-1" title={item.fullName || item.name}>
                {item.name}
              </span>
              <span className="text-xs tabular-nums text-neutral-600 shrink-0">
                <span className="font-semibold text-neutral-900">{item.value.toLocaleString('es-AR')}</span>
                {valueSuffix && <span className="text-neutral-500 ml-0.5">{valueSuffix}</span>}
                {showPercent && <span className="text-neutral-400 ml-1.5">({pct.toFixed(1)}%)</span>}
              </span>
            </div>
            {/* Bar */}
            <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-110"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CategoryBarChart;
