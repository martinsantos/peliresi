import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ notices: vi.fn(), manifest: vi.fn(), leg: vi.fn(), carrier: vi.fn(), send: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  notificacion: { findMany: mocks.notices }, manifiesto: { findUnique: mocks.manifest }, tramoTransporte: { findFirst: mocks.leg }, transportista: { findFirst: mocks.carrier },
} }));
vi.mock('../../services/push.service', () => ({ enviarPushAlUsuario: mocks.send }));
import { dispatchCommittedManifestPush, manifestPushContent } from '../../services/committed-manifest-push.service';
import { inTrainingSession } from '../../lib/trainingScope';
const user = { email: 'push@qa.invalid', activo: true, emailVerified: true, notifEmail: false, rol: 'TRANSPORTISTA', esInspector: false };
const notice = { id: 'notice', usuarioId: 'carrier', tipo: 'INFO_GENERAL', manifiestoId: 'manifest', datos: '{"tipo":"adenda_manifiesto","evento":"CREADA","nota":"PRIVATE"}', createdAt: new Date(), usuario: user };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('PUSH_MANIFEST_NOTICES_ENABLED', 'true'); mocks.notices.mockResolvedValue([notice]);
  mocks.manifest.mockResolvedValue({ isDemoData: false, transportista: { usuarioId: 'carrier' } }); mocks.send.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it('attempts a controlled notification only for the committed notice IDs and verifies current ownership', async () => {
  expect(await dispatchCommittedManifestPush(['notice', 'notice'])).toBe(1);
  expect(mocks.notices).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['notice'] } } }));
  expect(mocks.send).toHaveBeenCalledWith('carrier', expect.objectContaining({ title: 'Nueva adenda para revisar', url: '/manifiestos/manifest/adendas', tag: 'notification:notice' }));
  expect(JSON.stringify(mocks.send.mock.calls)).not.toContain('PRIVATE');
});
it.each([{ activo: false }, { emailVerified: false }])('suppresses an ineligible recipient %j', async change => {
  mocks.notices.mockResolvedValue([{ ...notice, usuario: { ...user, ...change } }]);
  expect(await dispatchCommittedManifestPush(['notice'])).toBe(0); expect(mocks.send).not.toHaveBeenCalled();
});
it('never sends training, synthetic data, a disabled channel or a deleted resource', async () => {
  expect(await inTrainingSession(() => dispatchCommittedManifestPush(['notice']))).toBe(0); expect(mocks.notices).not.toHaveBeenCalled();
  vi.stubEnv('PUSH_MANIFEST_NOTICES_ENABLED', 'false'); expect(await dispatchCommittedManifestPush(['notice'])).toBe(0);
  vi.stubEnv('PUSH_MANIFEST_NOTICES_ENABLED', 'true');
  for (const source of [null, { isDemoData: true }]) { mocks.manifest.mockResolvedValue(source); expect(await dispatchCommittedManifestPush(['notice'])).toBe(0); }
  expect(mocks.send).not.toHaveBeenCalled();
});
it('uses the replacement profile for its own registered leg history without exposing the original dossier', async () => {
  mocks.notices.mockResolvedValue([{ ...notice, datos: '{"tipo":"relevo_transporte","tramoId":"leg","url":"https://untrusted.invalid"}' }]);
  mocks.manifest.mockResolvedValue({ isDemoData: false, transportista: { usuarioId: 'original' } }); mocks.carrier.mockResolvedValue({ id: 'carrier' }); mocks.leg.mockResolvedValue({ id: 'own-history' });
  expect(await dispatchCommittedManifestPush(['notice'])).toBe(1);
  expect(mocks.send).toHaveBeenCalledWith('carrier', expect.objectContaining({ url: '/transporte/perfil' }));
  mocks.send.mockClear(); mocks.leg.mockResolvedValue(null);
  expect(await dispatchCommittedManifestPush(['notice'])).toBe(0); expect(mocks.send).not.toHaveBeenCalled();
});
it('recognizes approval events without trusting arbitrary links or event labels', () => {
  for (const phase of ['creada', 'aprobada', 'iniciada', 'rechazada', 'aprobacion-OPERADOR']) {
    expect(manifestPushContent({ ...notice, rol: 'TRANSPORTISTA', datos: JSON.stringify({ tipo: 'propuesta_partes', fase: phase, url: '//untrusted.invalid' }) })?.url).toBe('/manifiestos/manifest');
  }
  expect(manifestPushContent({ ...notice, rol: 'TRANSPORTISTA', datos: '{"tipo":"propuesta_partes","fase":"__proto__"}' })).toBeNull();
  expect(manifestPushContent({ ...notice, rol: 'TRANSPORTISTA', datos: 'null' })).toBeNull();
});
it.each([
 ['EN_TRANSITO', 'MANIFIESTO_EN_TRANSITO'], ['ENTREGADO', 'MANIFIESTO_ENTREGADO'],
 ['RECIBIDO', 'MANIFIESTO_RECIBIDO'], ['EN_TRATAMIENTO', 'INFO_GENERAL'],
 ['TRATADO', 'MANIFIESTO_TRATADO'], ['CANCELADO', 'INFO_GENERAL'],
])('routes state push %s through the representative owned notice', (estado, tipo) => {
 const data = { tipo: 'estado_manifiesto', version: 1, estado, destino: 'representante',
  accesosEmpresa: [{ empresaId: 'co', actividadId: 'activity' }], nota: 'PRIVATE' };
 const content = manifestPushContent({ ...notice, rol: 'GENERADOR', tipo, datos: JSON.stringify(data) });
 expect(content?.url).toBe('/notificaciones/notice'); expect(JSON.stringify(content)).not.toContain('PRIVATE');
 expect(manifestPushContent({ ...notice, id: undefined, rol: 'GENERADOR', tipo, datos: JSON.stringify(data) })).toBeNull();
});
it.each(['propuesta_partes', 'adenda_manifiesto'])('routes representative %s push through the owned notice', tipo => {
 const data = { tipo, version: 1, fase: 'creada', evento: 'CREADA', accesosEmpresa: [{ empresaId: 'co', actividadId: 'a' }] };
 expect(manifestPushContent({ ...notice, rol: 'GENERADOR', datos: JSON.stringify(data) })?.url).toBe('/notificaciones/notice');
});
