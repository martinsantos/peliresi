// Shared utilities for report tabs
import React from 'react';

// ── CSV metadata type ──
export interface CsvMetadata {
  titulo?: string;
  fecha?: string;
  periodo?: string;
  filtros?: string;
  total?: number;
}

// ── CSV download helper ──
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][], metadata?: CsvMetadata) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const metaLines: string[] = [];
  if (metadata) {
    if (metadata.titulo) metaLines.push(`# SITREP - ${metadata.titulo}`);
    metaLines.push(`# Fecha de exportacion: ${metadata.fecha || new Date().toLocaleDateString('es-AR')}`);
    if (metadata.periodo) metaLines.push(`# Periodo: ${metadata.periodo}`);
    if (metadata.filtros) metaLines.push(`# Filtros: ${metadata.filtros}`);
    if (metadata.total != null) metaLines.push(`# Total registros: ${metadata.total}`);
    metaLines.push('#');
  }
  const dataLines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const csv = [...metaLines, ...dataLines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Donut Center Label ──
export function DonutCenterLabel({ viewBox, total }: any) {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} y={cy - 8} className="fill-neutral-900 text-2xl font-bold">{total}</tspan>
      <tspan x={cx} y={cy + 12} className="fill-neutral-500 text-xs">Total</tspan>
    </text>
  );
}

// ── Cluster helper ──
export function clusterMarkers<T extends { latitud: number; longitud: number }>(
  items: T[],
): (T & { count?: number })[] {
  if (items.length < 50) return items;
  const gridSize = 0.05;
  const clusters = new Map<string, { items: T[]; lat: number; lng: number }>();
  for (const item of items) {
    const key = `${Math.round(item.latitud / gridSize)}_${Math.round(item.longitud / gridSize)}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.items.push(item);
      existing.lat = (existing.lat * (existing.items.length - 1) + item.latitud) / existing.items.length;
      existing.lng = (existing.lng * (existing.items.length - 1) + item.longitud) / existing.items.length;
    } else {
      clusters.set(key, { items: [item], lat: item.latitud, lng: item.longitud });
    }
  }
  return Array.from(clusters.values()).map(c => ({
    ...c.items[0],
    latitud: c.lat,
    longitud: c.lng,
    count: c.items.length > 1 ? c.items.length : undefined,
  }));
}
