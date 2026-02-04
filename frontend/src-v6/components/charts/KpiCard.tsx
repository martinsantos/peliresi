/**
 * SITREP v6 - Shared KPI Card for charts/reports
 */

import type React from 'react';

export function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-5 group hover:shadow-lg transition-all duration-300 hover-lift`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3 group-hover:scale-125 transition-transform duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon size={20} className="text-white" />
          </div>
        </div>
        <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
        <p className="text-sm text-white/80 font-medium mt-1">{label}</p>
        {sub && <p className="text-xs text-white/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
