/**
 * SITREP v6 - Reporte Service
 */

import api from './api';
import type { ReporteFilters, ExportFormat } from '../types/api';

export interface ReporteData {
  pagination?: { page: number; limit: number; total: number; pages: number };
  titulo: string;
  datos: Record<string, unknown>[];
  eventos?: Record<string, unknown>[];
  resumen: Record<string, unknown> & {
    total?: number;
    porTipo?: Record<string, number>;
  };
}

// Map frontend filter names to backend query param names
function mapFilters(filters?: ReporteFilters): Record<string, string | number | undefined> {
  if (!filters) return {};
  return {
    page: filters.page,
    limit: filters.limit,
    fechaInicio: filters.fechaDesde,
    fechaFin: filters.fechaHasta,
    generadorId: filters.generadorId,
    transportistaId: filters.transportistaId,
    operadorId: filters.operadorId,
    tipo: filters.tipo,
  };
}

type CsvRow = Record<string, unknown>;
type CsvReport = 'tratados' | 'transporte';
const CSV_MAX_RECORDS = 10000;

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Spreadsheet formulas are text, not executable cells; preserve real numbers.
  if (typeof value !== 'number' && /^\s*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

async function exportReportCsv(tipo: CsvReport, filters?: ReporteFilters): Promise<Blob> {
  const limit = tipo === 'tratados' ? 500 : 200;
  const key = tipo === 'tratados' ? 'detalle' : 'transportistas';
  const rows: CsvRow[] = [];
  const ids = new Set<string>();
  let expectedTotal: number | undefined;
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    // Sequential requests keep memory/connections bounded and reuse server permissions.
    const { data } = await api.get(`/reportes/${tipo}`, { params: { ...mapFilters(filters), page, limit } });
    const result = data.data;
    const pagination = result?.pagination;
    const items = result?.[key];
    if (!pagination || !Array.isArray(items) || !Number.isSafeInteger(pagination.total) || pagination.total < 0
      || pagination.page !== page || pagination.limit !== limit || pagination.pages !== Math.ceil(pagination.total / limit)) {
      throw new Error('El reporte devolvió una página inconsistente. Actualizá y reintentá.');
    }
    if (pagination.total > CSV_MAX_RECORDS) throw new Error('La exportación admite hasta 10.000 registros. Reducí el período.');
    if (expectedTotal !== undefined && expectedTotal !== pagination.total) throw new Error('El reporte cambió durante la exportación. Actualizá y reintentá.');
    expectedTotal = pagination.total;
    pages = pagination.pages;
    for (const item of items as CsvRow[]) {
      const id = item[tipo === 'tratados' ? 'id' : 'transportistaId'];
      if (typeof id !== 'string' || !id || ids.has(id)) throw new Error('El reporte cambió o devolvió registros inconsistentes. Actualizá y reintentá.');
      ids.add(id);
      rows.push(item);
    }
  }
  if (rows.length !== expectedTotal) throw new Error('El reporte devolvió un listado incompleto. Actualizá y reintentá.');
  const headers = tipo === 'tratados'
    ? ['Número', 'Generador', 'Método', 'Fecha de tratamiento', 'Código', 'Residuo', 'Cantidad', 'Unidad']
    : ['Transportista', 'CUIT', 'Viajes', 'Completados', 'En tránsito', 'Pendientes', 'Vehículos registrados', 'Choferes registrados', 'Tasa de completitud'];
  const csvRows: unknown[][] = [];
  for (const row of rows) {
    if (tipo === 'transporte') {
      csvRows.push([row.transportista, row.cuit, row.totalViajes, row.completados, row.enTransito, row.pendientes, row.vehiculosRegistrados, row.choferesRegistrados, row.tasaCompletitud]);
    } else {
      const residues = Array.isArray(row.residuos) && row.residuos.length ? row.residuos as CsvRow[] : [{}];
      for (const residue of residues) csvRows.push([row.numero, row.generador, row.metodoTratamiento, row.fechaTratamiento, residue.codigo, residue.nombre, residue.cantidad, residue.unidad]);
    }
  }
  return new Blob(['\ufeff', [headers, ...csvRows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

export const reporteService = {
  async manifiestos(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/manifiestos', { params: mapFilters(filters) });
    return data.data;
  },

  async tratados(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/tratados', { params: mapFilters(filters) });
    return data.data;
  },

  async transporte(filters?: ReporteFilters): Promise<ReporteData> {
    const { data } = await api.get('/reportes/transporte', { params: mapFilters(filters) });
    return data.data;
  },

  async auditoria(filters?: ReporteFilters & { page?: number; limit?: number; accion?: string; usuarioId?: string; sortBy?: string; sortOrder?: string; fuente?: 'manifiestos' | 'inspecciones' }): Promise<ReporteData> {
    const mapped = mapFilters(filters);
    const params: Record<string, string | number | undefined> = {
      ...mapped,
      page: filters?.page,
      limit: filters?.limit,
      accion: filters?.accion,
      usuarioId: filters?.usuarioId,
      sortBy: filters?.sortBy,
      sortOrder: filters?.sortOrder,
      fuente: filters?.fuente,
    };
    const { data } = await api.get('/reportes/auditoria', { params });
    return data.data;
  },

  async exportar(tipo: string, formato: ExportFormat, filters?: ReporteFilters): Promise<Blob> {
    if (formato === 'csv' && (tipo === 'tratados' || tipo === 'transporte')) return exportReportCsv(tipo, filters);
    const { data } = await api.get(`/reportes/exportar/${tipo}`, {
      params: { formato, ...mapFilters(filters) },
      responseType: 'blob',
    });
    return data;
  },
};
