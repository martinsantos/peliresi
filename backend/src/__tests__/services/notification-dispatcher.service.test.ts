import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  manifiesto: { findUnique: vi.fn() },
  usuario: { findMany: vi.fn() },
}));
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('../../services/push.service', () => ({ enviarPushAlUsuario: vi.fn() }));

import { notificationService } from '../../services/notification-dispatcher.service';

const actor = (id: string, razonSocial: string) => ({ razonSocial, usuario: { id }, domicilio: 'Calle QA 123', latitud: -32.8, longitud: -68.8 });
const manifest = (modalidad: 'IN_SITU' | 'FIJO', carrier = true) => ({
  id: 'm-qa', numero: 'M-001', modalidad, fechaEstimadaRetiro: new Date('2099-01-01T12:00:00Z'),
  generador: actor('g', 'Generador QA'), transportista: carrier ? actor('t', 'Transporte QA') : null,
  operador: actor('o', 'Operador QA'),
});

describe('state notices reflect whether a trip exists', () => {
  beforeEach(() => { db.usuario.findMany.mockResolvedValue([{ id: 'admin' }]); });
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it('does not assign a pickup to the approving carrier for treatment in origin', async () => {
    db.manifiesto.findUnique.mockResolvedValue(manifest('IN_SITU'));
    const send = vi.spyOn(notificationService, 'crearNotificacion').mockResolvedValue({} as never);
    await notificationService.notificarCambioEstado('m-qa', 'APROBADO');
    const notices = send.mock.calls.map(([notice]) => notice);
    expect(notices.map(n => n.usuarioId).sort()).toEqual(['admin', 'g', 'o', 't']);
    const carrier = notices.find(n => n.usuarioId === 't')!;
    expect(carrier.titulo).toContain('origen');
    expect(carrier.mensaje).toContain('No hay retiro, traslado ni GPS');
    expect(carrier.datos).toEqual({ tipo: 'tratamiento_insitu', generador: 'Generador QA', operadorDestino: 'Operador QA' });
    expect(notices.find(n => n.usuarioId === 'g')!.mensaje).toContain('tratamiento en origen');
    expect(notices.find(n => n.usuarioId === 'o')!.mensaje).toContain('coordinar la recepción');
  });

  it('preserves pickup guidance for an ordinary shipment', async () => {
    db.manifiesto.findUnique.mockResolvedValue(manifest('FIJO'));
    const send = vi.spyOn(notificationService, 'crearNotificacion').mockResolvedValue({} as never);
    await notificationService.notificarCambioEstado('m-qa', 'APROBADO');
    const notices = send.mock.calls.map(([notice]) => notice);
    const carrier = notices.find(n => n.usuarioId === 't')!;
    expect(carrier.titulo).toBe('Nuevo retiro asignado');
    expect(carrier.datos.tipo).toBe('retiro_asignado');
    expect(carrier.datos.mapsUrl).toContain('maps');
    expect(notices.find(n => n.usuarioId === 'g')!.mensaje).toContain('listo para retiro');
  });

  it('keeps historical origin records without a carrier readable', async () => {
    db.manifiesto.findUnique.mockResolvedValue(manifest('IN_SITU', false));
    const send = vi.spyOn(notificationService, 'crearNotificacion').mockResolvedValue({} as never);
    await notificationService.notificarCambioEstado('m-qa', 'APROBADO');
    const notices = send.mock.calls.map(([notice]) => notice);
    expect(notices.map(n => n.usuarioId).sort()).toEqual(['admin', 'g', 'o']);
    expect(notices.find(n => n.usuarioId === 'g')!.mensaje).toContain('tratamiento en origen');
  });
});
