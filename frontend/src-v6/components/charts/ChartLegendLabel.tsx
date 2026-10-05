import type { ReactNode } from 'react';

/** A data-series swatch may be bright; the adjacent label must remain legible. */
export function ChartLegendLabel(value: ReactNode) {
  return <span className="text-neutral-700">{value}</span>;
}
