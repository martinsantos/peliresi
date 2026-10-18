import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  eventoInspeccion: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  eventoManifiesto: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
}));
vi.mock('../../lib/prisma', () => ({ default: db }));
import { getLogAuditoria } from '../../controllers/reporte.controller';

const response = () => ({ json: vi.fn() });
const user = { id: 'admin-1', rol: 'ADMIN' };

beforeEach(() => {
  vi.clearAllMocks();
  db.eventoInspeccion.findMany.mockResolvedValue([{ id: 'event-1', tipo: 'ORGANIZACION_ACTUALIZADA', titulo: 'Visita reprogramada', detalle: 'Motivo registrado', createdAt: new Date('2026-09-24T14:00:00Z'), usuario: { nombre: 'Ana', apellido: 'Inspector', rol: 'ADMIN' }, inspeccion: { id: 'inspection-1', numero: 'IRP-2026-00001' } }]);
  db.eventoInspeccion.count.mockResolvedValue(1);
  db.eventoInspeccion.groupBy.mockResolvedValue([{ tipo: 'ORGANIZACION_ACTUALIZADA', _count: 1 }]);
});

describe('inspection events in the audit workspace', () => {
  it('uses filtered, paginated inspection events and keeps a link to the original dossier', async () => {
    const res = response(); const next = vi.fn();
    await getLogAuditoria({ user, query: { fuente: 'inspecciones', page: '2', limit: '25', usuarioId: 'inspector-1', fechaInicio: '2026-09-24', fechaFin: '2026-09-24' } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.eventoInspeccion.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25,
      where: expect.objectContaining({ usuarioId: 'inspector-1', createdAt: expect.anything() }),
    }));
    expect(db.eventoManifiesto.findMany).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.eventos[0]).toMatchObject({ modulo: 'Inspecciones', inspeccionId: 'inspection-1', inspeccionNumero: 'IRP-2026-00001', descripcion: 'Visita reprogramada · Motivo registrado' });
    expect(res.json.mock.calls[0][0].data.resumen).toEqual({ total: 1, porTipo: { ORGANIZACION_ACTUALIZADA: 1 } });
  });

  it('keeps the existing manifest audit as the default source', async () => {
    db.eventoManifiesto.findMany.mockResolvedValue([]);
    db.eventoManifiesto.count.mockResolvedValue(0);
    db.eventoManifiesto.groupBy.mockResolvedValue([]);
    const next = vi.fn();
    await getLogAuditoria({ user, query: {} } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.eventoManifiesto.findMany).toHaveBeenCalled();
    expect(db.eventoInspeccion.findMany).not.toHaveBeenCalled();
  });

  it('rejects unauthorized access and unsupported sources', async () => {
    const denied = vi.fn();
    await getLogAuditoria({ user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true }, query: { fuente: 'inspecciones' } } as any, response() as any, denied);
    expect(denied.mock.calls[0][0].statusCode).toBe(403);
    const invalid = vi.fn();
    await getLogAuditoria({ user, query: { fuente: 'unknown' } } as any, response() as any, invalid);
    expect(invalid.mock.calls[0][0].statusCode).toBe(400);
    expect(db.eventoInspeccion.findMany).not.toHaveBeenCalled();
  });
});
