import { describe, expect, it } from 'vitest';
import { bulkUploadFailureMessage, summarizeBulkUpload } from '../../utils/bulkUploadResult';

describe('bulk upload summary follows the server contract { total, exitosos, errores }', () => {
  it('reports every row failing as an error, not as completed', () => {
    expect(summarizeBulkUpload({ total: 3, exitosos: 0, errores: [{ linea: 2, error: 'CUIT inválido' }, { linea: 3, error: 'CUIT inválido' }, { linea: 4, error: 'Email duplicado' }] }))
      .toEqual({ registros: 3, exitosos: 0, fallidos: 3, estado: 'error', errores: expect.arrayContaining([{ linea: 4, error: 'Email duplicado' }]) });
  });
  it('reports a partial upload with its failing rows', () => {
    expect(summarizeBulkUpload({ total: 3, exitosos: 2, errores: [{ linea: 3, error: 'Falta razón social' }] })).toMatchObject({ exitosos: 2, fallidos: 1, estado: 'parcial' });
  });
  it('reports a clean upload as completed', () => {
    expect(summarizeBulkUpload({ total: 2, exitosos: 2, errores: [] })).toMatchObject({ exitosos: 2, fallidos: 0, estado: 'completado' });
  });
  it('never counts rows as successful when the response is missing', () => {
    expect(summarizeBulkUpload(null)).toMatchObject({ registros: 0, exitosos: 0, estado: 'error' });
  });
});

describe('bulk upload failure reason', () => {
  it('shows the server reason', () => {
    expect(bulkUploadFailureMessage(400, JSON.stringify({ success: false, error: 'Archivo no proporcionado' }))).toBe('Archivo no proporcionado');
    expect(bulkUploadFailureMessage(403, JSON.stringify({ message: 'Sin permisos' }))).toBe('Sin permisos');
  });
  it('explains an expired session and a lost connection without blaming the file format', () => {
    expect(bulkUploadFailureMessage(401, '')).toMatch(/sesión venció/);
    expect(bulkUploadFailureMessage(0, '')).toMatch(/No se pudo conectar/);
  });
});
