import { beforeEach, expect, it, vi } from 'vitest';
const recipients = vi.hoisted(() => vi.fn());
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipientsBatch: recipients }));
import { matchingManifestRuleAccesses, maskManifestRuleCompanyNotice, withManifestRuleCompanyNoticeContext } from '../../services/manifestRuleCompanyNotice.service';

const access = { empresaId: 'co', actividadId: 'activity', rol: 'GENERADOR', razonSocial: 'QA Empresa', establecimientoId: 'site', establecimiento: 'Norte' };
const data = { tipo: 'duracion_transito_configurada', version: 1, destino: 'representante', accesosEmpresa: [access], numero: 'QA-PRIVATE' };
const notice = { usuarioId: 'rep', manifiestoId: 'manifest', tipo: 'ALERTA_SISTEMA', titulo: 'QA-PRIVATE', mensaje: 'QA-PRIVATE', datos: JSON.stringify(data), manifiesto: { numero: 'QA-PRIVATE' } };
beforeEach(() => recipients.mockReset());

it('shows only the still-authorized original activity and site', async () => {
 recipients.mockResolvedValue(new Map([['manifest', [{ usuarioId: 'rep', accesosEmpresa: [access] }]]]));
 const result = await withManifestRuleCompanyNoticeContext({} as any, [notice]);
 expect(result[0].titulo).toBe('QA-PRIVATE'); expect(JSON.parse(result[0].datos!).accesosEmpresa).toEqual([access]);
 expect(recipients).toHaveBeenCalledOnce();
});
it.each(['revoked', 'different-company', 'different-activity', 'different-role', 'different-site', 'missing-site'])(
 'masks title, message, manifest and metadata for %s', async reason => {
  const changed = reason === 'different-company' ? { ...access, empresaId: 'other' }
   : reason === 'different-activity' ? { ...access, actividadId: 'other' }
   : reason === 'different-role' ? { ...access, rol: 'OPERADOR' }
   : reason === 'different-site' ? { ...access, establecimientoId: 'other' }
   : reason === 'missing-site' ? { ...access, establecimientoId: undefined } : access;
  recipients.mockResolvedValue(new Map([['manifest', reason === 'revoked' ? [] : [{ usuarioId: 'rep', accesosEmpresa: [changed] }]]]));
  const masked = (await withManifestRuleCompanyNoticeContext({} as any, [notice]))[0];
  expect(masked.titulo).toBe('Aviso no disponible'); expect(masked.manifiestoId).toBeNull(); expect(masked.manifiesto).toBeNull();
  expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
 });
it('masks the response of marking a representative notice as read', () => {
 expect(JSON.stringify(maskManifestRuleCompanyNotice(notice))).not.toContain('QA-PRIVATE');
 expect(maskManifestRuleCompanyNotice(notice).manifiestoId).toBeNull();
});
it('masks a reversion notice after the representative loses access', async () => {
 const reversion = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ ...data, tipo: 'reversion_manifiesto' }) };
 recipients.mockResolvedValue(new Map([['manifest', []]]));
 const masked = (await withManifestRuleCompanyNoticeContext({} as any, [reversion]))[0];
 expect(masked.manifiestoId).toBeNull(); expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
 expect(JSON.stringify(maskManifestRuleCompanyNotice(reversion))).not.toContain('QA-PRIVATE');
});
it('masks a representative signature reminder when its original authorization is revoked', async () => {
 const reminder = { ...notice, tipo: 'VENCIMIENTO_PROXIMO', datos: JSON.stringify({ ...data, tipo: 'recordatorio_firma', fase: 'SEMANA' }) };
 recipients.mockResolvedValue(new Map([['manifest', []]]));
 const masked = (await withManifestRuleCompanyNoticeContext({} as any, [reminder]))[0];
 expect(masked.titulo).toBe('Aviso no disponible'); expect(masked.manifiestoId).toBeNull();
 expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
 expect(JSON.stringify(maskManifestRuleCompanyNotice(reminder))).not.toContain('QA-PRIVATE');
});
it('does not turn malformed or stale metadata into authorization', () => {
 expect(matchingManifestRuleAccesses({ ...data, version: 2 }, [access])).toEqual([]);
 expect(matchingManifestRuleAccesses({ ...data, accesosEmpresa: [{ ...access, actividadId: '../other' }] }, [access])).toEqual([]);
});
it('does not alter direct-owner notices', async () => {
 const direct = { ...notice, datos: JSON.stringify({ tipo: 'duracion_transito_configurada', version: 1 }) };
 expect(await withManifestRuleCompanyNoticeContext({} as any, [direct])).toEqual([direct]); expect(recipients).not.toHaveBeenCalled();
});
it.each([
 ['INCIDENTE', 'INCIDENTE_REPORTADO'], ['RECHAZO', 'MANIFIESTO_RECHAZADO'], ['DIFERENCIA_PESO', 'ALERTA_SISTEMA'], ['ENTREGA', 'MANIFIESTO_ENTREGADO'],
])('masks a revoked operational event %s', async (event, tipo) => {
 const operational = { ...notice, tipo, datos: JSON.stringify({ ...data, tipo: 'alerta_evento_manifiesto', evento: event }) };
 recipients.mockResolvedValue(new Map([['manifest', []]]));
 const masked = (await withManifestRuleCompanyNoticeContext({} as any, [operational]))[0];
 expect(masked.titulo).toBe('Aviso no disponible'); expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
 expect(JSON.stringify(maskManifestRuleCompanyNotice(operational))).not.toContain('QA-PRIVATE');
});

it.each([
 ['EN_TRANSITO', 'MANIFIESTO_EN_TRANSITO'], ['ENTREGADO', 'MANIFIESTO_ENTREGADO'],
 ['RECIBIDO', 'MANIFIESTO_RECIBIDO'], ['EN_TRATAMIENTO', 'INFO_GENERAL'],
 ['TRATADO', 'MANIFIESTO_TRATADO'], ['CANCELADO', 'INFO_GENERAL'],
])('masks a revoked representative state notice %s', async (estado, tipo) => {
 const state = { ...notice, tipo, datos: JSON.stringify({ ...data, tipo: 'estado_manifiesto', estado }) };
 recipients.mockResolvedValue(new Map([['manifest', []]]));
 const masked = (await withManifestRuleCompanyNoticeContext({} as any, [state]))[0];
 expect(masked.titulo).toBe('Aviso no disponible'); expect(masked.manifiestoId).toBeNull();
 expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
 expect(JSON.stringify(maskManifestRuleCompanyNotice(state))).not.toContain('QA-PRIVATE');
});

it.each(['propuesta_partes', 'adenda_manifiesto', 'certificado_manifiesto'])(
 'masks a legacy representative %s notice after the original company access is revoked', async tipo => {
  const legacy = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ ...data, tipo, destino: undefined }) };
  recipients.mockResolvedValue(new Map([['manifest', []]]));
  const db = { manifiesto: { findMany: vi.fn().mockResolvedValue([]) } };
  const masked = (await withManifestRuleCompanyNoticeContext(db as any, [legacy]))[0];
  expect(masked.titulo).toBe('Aviso no disponible'); expect(masked.manifiestoId).toBeNull();
  expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
  expect(JSON.stringify(maskManifestRuleCompanyNotice(legacy))).not.toContain('QA-PRIVATE');
 });

it('retains a legacy notice for its active direct owner after company access is revoked', async () => {
 const legacy = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ ...data, tipo: 'propuesta_partes', destino: undefined }) };
 recipients.mockResolvedValue(new Map([['manifest', []]]));
 const db = { manifiesto: { findMany: vi.fn().mockResolvedValue([{ id: 'manifest',
  generador: { usuarioId: 'rep', activo: true }, transportista: null, operador: { usuarioId: 'other', activo: true } }]) } };
 const visible = (await withManifestRuleCompanyNoticeContext(db as any, [legacy]))[0];
 expect(visible.titulo).toBe('QA-PRIVATE'); expect(visible.manifiestoId).toBe('manifest');
 expect(JSON.parse(visible.datos!).accesosEmpresa).toBeUndefined();
});
