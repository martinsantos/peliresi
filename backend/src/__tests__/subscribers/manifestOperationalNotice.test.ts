import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rules: vi.fn(), notice: vi.fn(), stateNotice: vi.fn(), manifest: vi.fn(), users: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { reglaAlerta: { findMany: mocks.rules },
 manifiesto: { findUnique: mocks.manifest }, usuario: { findMany: mocks.users } } }));
vi.mock('../../controllers/notification.controller', () => ({ notificationService: { crearNotificacion: mocks.notice, notificarCambioEstado: mocks.stateNotice } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
import { alertaSubscriber } from '../../subscribers/alerta.subscriber';

beforeEach(() => { vi.clearAllMocks(); mocks.rules.mockResolvedValue([]); });
it.each([
 { type: 'INCIDENTE_REGISTRADO', manifiestoId: 'm', tipoIncidente: 'QA', descripcion: 'QA', userId: 'u', expected: 'INCIDENTE' },
 { type: 'RECHAZO_CARGA', manifiestoId: 'm', motivo: 'QA', numero: 'QA', userId: 'u', expected: 'RECHAZO_CARGA' },
 { type: 'DIFERENCIA_PESO', manifiestoId: 'm', pesoDeclarado: 10, pesoReal: 12, delta: '20%', deltaPorcentaje: 20, userId: 'u', expected: 'DIFERENCIA_PESO' },
 { type: 'MANIFIESTO_ESTADO_CAMBIADO', manifiestoId: 'm', estadoAnterior: 'EN_TRANSITO', estadoNuevo: 'ENTREGADO', numero: 'QA', userId: 'u', expected: 'CAMBIO_ESTADO' },
])('does not duplicate the committed $type notice, but still evaluates configured rules', async ({ expected, ...event }) => {
 await alertaSubscriber({ ...event, avisosConfirmados: true } as any);
 expect(mocks.notice).not.toHaveBeenCalled(); expect(mocks.stateNotice).not.toHaveBeenCalled(); expect(mocks.manifest).not.toHaveBeenCalled();
 expect(mocks.rules).toHaveBeenCalledWith({ where: { evento: expected, activa: true } });
});
