/**
 * SITREP v6 - Shared Recharts Tooltip
 */

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-neutral-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: p.color || p.fill }}>
          <span className="font-bold">{p.value}</span> {p.name}
        </p>
      ))}
    </div>
  );
}
