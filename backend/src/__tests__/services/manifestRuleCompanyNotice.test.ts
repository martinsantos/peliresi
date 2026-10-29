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
it('does not turn malformed or stale metadata into authorization', () => {
 expect(matchingManifestRuleAccesses({ ...data, version: 2 }, [access])).toEqual([]);
 expect(matchingManifestRuleAccesses({ ...data, accesosEmpresa: [{ ...access, actividadId: '../other' }] }, [access])).toEqual([]);
});
it('does not alter direct-owner notices', async () => {
 const direct = { ...notice, datos: JSON.stringify({ tipo: 'duracion_transito_configurada', version: 1 }) };
 expect(await withManifestRuleCompanyNoticeContext({} as any, [direct])).toEqual([direct]); expect(recipients).not.toHaveBeenCalled();
});
it.each([
 ['INCIDENTE', 'INCIDENTE_REPORTADO'], ['RECHAZO', 'MANIFIESTO_RECHAZADO'], ['DIFERENCIA_PESO', 'ALERTA_SISTEMA'],
])('masks a revoked operational event %s', async (event, tipo) => {
 const operational = { ...notice, tipo, datos: JSON.stringify({ ...data, tipo: 'alerta_evento_manifiesto', evento: event }) };
 recipients.mockResolvedValue(new Map([['manifest', []]]));
 const masked = (await withManifestRuleCompanyNoticeContext({} as any, [operational]))[0];
 expect(masked.titulo).toBe('Aviso no disponible'); expect(JSON.stringify(masked)).not.toContain('QA-PRIVATE');
 expect(JSON.stringify(maskManifestRuleCompanyNotice(operational))).not.toContain('QA-PRIVATE');
});
