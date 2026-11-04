import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ create: vi.fn(), many: vi.fn(), users: vi.fn(), user: vi.fn(), send: vi.fn(), push: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { notificacion: { create: state.create, createMany: state.many }, usuario: { findUnique: state.user, findMany: state.users } } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendAlertEmail: state.send } }));
vi.mock('../../services/push.service', () => ({ enviarPushAlUsuario: state.push }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
import { notificationService } from '../../services/notification-dispatcher.service';
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
it('persists the notice without a second direct email path, leaving push independent', async () => {
  vi.useFakeTimers();
  state.create.mockResolvedValue({ id: 'committed-notice', usuarioId: 'qa', tipo: 'MANIFIESTO_FIRMADO', titulo: 'QA',
    mensaje: 'QA', manifiestoId: 'manifest', prioridad: 'NORMAL' });
  state.user.mockResolvedValue({ notifEmail: true, email: 'qa@example.invalid' });
  state.push.mockResolvedValue(undefined);
  const result = await notificationService.crearNotificacion({ usuarioId: 'qa', tipo: 'MANIFIESTO_FIRMADO', titulo: 'QA', mensaje: 'QA', manifiestoId: 'manifest' });
  await vi.runAllTimersAsync();
  expect(result.id).toBe('committed-notice');
  expect(state.create).toHaveBeenCalledOnce();
  expect(state.send).not.toHaveBeenCalled();
  expect(state.push).toHaveBeenCalledWith('qa', expect.objectContaining({ url: '/notificaciones/committed-notice', title: 'QA' }));
});

it('dispatches channels for an already committed notice without inserting another one', async () => {
  vi.useFakeTimers();
  state.user.mockResolvedValue({ notifEmail: true, email: 'qa@example.invalid' });
  state.push.mockResolvedValue(undefined);
  notificationService.programarCanalesDeNotificacion({ id: 'saved', usuarioId: 'qa', tipo: 'ALERTA_SISTEMA', titulo: 'Umbral',
    mensaje: 'Referencia operativa', manifiestoId: 'manifest', prioridad: 'ALTA' });
  await vi.runAllTimersAsync();
  expect(state.create).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
  expect(state.push).toHaveBeenCalledWith('qa', expect.objectContaining({ url: '/notificaciones/saved', title: 'Umbral' }));
});

it('bulk notices keep a distinct private destination per recipient', async () => {
  vi.useFakeTimers(); state.users.mockResolvedValue([{id:'one'},{id:'two'}]); state.many.mockResolvedValue({count:2}); state.push.mockResolvedValue(undefined);
  await notificationService.notificarPorRol('ADMIN',{tipo:'INFO_GENERAL',titulo:'QA',mensaje:'QA'});
  await vi.runAllTimersAsync();
  const rows=state.many.mock.calls[0][0].data;
  expect(rows).toHaveLength(2);expect(rows[0].id).not.toBe(rows[1].id);
  for (const row of rows) expect(state.push).toHaveBeenCalledWith(row.usuarioId,expect.objectContaining({url:'/notificaciones/'+row.id}));
  expect(state.send).not.toHaveBeenCalled();
});
