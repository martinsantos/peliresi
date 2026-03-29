/**
 * SITREP v6 - CSV Export Utility
 */

export interface CsvMetadata {
  titulo?: string;
  fecha?: string;
  periodo?: string;
  filtros?: string;
  total?: number;
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string, metadata?: CsvMetadata) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const metaLines: string[] = [];
  if (metadata) {
    if (metadata.titulo) metaLines.push(`# SITREP - ${metadata.titulo}`);
    metaLines.push(`# Fecha de exportacion: ${metadata.fecha || new Date().toLocaleDateString('es-AR')}`);
    if (metadata.periodo) metaLines.push(`# Periodo: ${metadata.periodo}`);
    if (metadata.filtros) metaLines.push(`# Filtros: ${metadata.filtros}`);
    if (metadata.total != null) metaLines.push(`# Total registros: ${metadata.total}`);
    metaLines.push('#');
  }

  const dataLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val == null ? '' : String(val);
        // Escape values containing commas, quotes, or newlines
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];

  const csv = [...metaLines, ...dataLines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
