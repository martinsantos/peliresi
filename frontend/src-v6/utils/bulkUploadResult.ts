// Bulk upload endpoints answer { total, exitosos, errores: [{ linea, error }] } (no "fallidos").
export interface BulkUploadRowError { linea: number; error: string }

export interface BulkUploadSummary {
  registros: number;
  exitosos: number;
  fallidos: number;
  estado: 'completado' | 'parcial' | 'error';
  errores: BulkUploadRowError[];
}

export function summarizeBulkUpload(data: unknown): BulkUploadSummary {
  const result = (data && typeof data === 'object' ? data : {}) as { total?: unknown; exitosos?: unknown; errores?: unknown };
  const errores = Array.isArray(result.errores)
    ? result.errores.filter((row): row is BulkUploadRowError => Boolean(row) && typeof row === 'object' && typeof (row as BulkUploadRowError).error === 'string')
    : [];
  const registros = typeof result.total === 'number' ? result.total : 0;
  const exitosos = typeof result.exitosos === 'number' ? result.exitosos : 0;
  const fallidos = errores.length;
  const estado = fallidos === 0 && registros > 0 ? 'completado' : exitosos > 0 ? 'parcial' : 'error';
  return { registros, exitosos, fallidos, estado, errores };
}

/** Readable reason for a rejected upload, from the raw XHR status and body. */
export function bulkUploadFailureMessage(status: number, body: string): string {
  if (status === 401) return 'La sesión venció. Volvé a ingresar y reintentá; el archivo sigue seleccionado.';
  if (status === 0) return 'No se pudo conectar con SITREP. Revisá la conexión y reintentá; el archivo sigue seleccionado.';
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const reason = typeof parsed.message === 'string' ? parsed.message : typeof parsed.error === 'string' ? parsed.error : '';
    if (reason.trim()) return reason;
  } catch { /* non-JSON body: fall through */ }
  return 'No se pudo procesar el archivo. Revisá el formato y reintentá; el archivo sigue seleccionado.';
}
