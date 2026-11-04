import { expect, it } from 'vitest';
import { matchingEventualRecipient, maskEventualNotice } from '../../services/eventualNoticeContext.service';
import type { EventualRecipient } from '../../services/eventualNotice.service';

const current: EventualRecipient = { id: 'person', autoridad: false,
 actividadesPropias: [{ rol: 'OPERADOR', actorId: 'operator' }],
 accesosEmpresa: [{ empresaId: 'company', actividadId: 'activity', autorizacionId: 'grant', revision: 4,
  rol: 'GENERADOR', actorId: 'generator', razonSocial: 'Entidad QA' }] };
const snapshot = { accesoVersion: 1, actividadesPropias: current.actividadesPropias, accesosEmpresa: current.accesosEmpresa, autoridad: false };
it('matches only the activity and grant originally addressed', () => {
 expect(matchingEventualRecipient(snapshot, current)).toEqual(current);
 expect(matchingEventualRecipient({ ...snapshot, actividadesPropias: [] }, current)?.actividadesPropias).toEqual([]);
 expect(matchingEventualRecipient({ ...snapshot, actividadesPropias: [], accesosEmpresa: [{ ...current.accesosEmpresa[0], revision: 3 }] }, current)).toBeNull();
 expect(matchingEventualRecipient({ ...snapshot, actividadesPropias: [], accesosEmpresa: [{ ...current.accesosEmpresa[0], empresaId: 'different' }] }, current)).toBeNull();
 expect(matchingEventualRecipient(snapshot, undefined)).toBeNull();
});
it('does not infer a company context for older notices or accept malformed snapshots', () => {
 expect(matchingEventualRecipient({}, { ...current, actividadesPropias: [] })).toBeNull();
 expect(matchingEventualRecipient({}, current)?.accesosEmpresa).toEqual([]);
 expect(matchingEventualRecipient({ ...snapshot, accesoVersion: 2 }, current)).toBeNull();
 expect(matchingEventualRecipient({ ...snapshot, accesosEmpresa: 'bad' }, current)).toBeNull();
});
it('permits an originally addressed authority only while that authority remains eligible', () => {
 const authority = { ...current, actividadesPropias: [], accesosEmpresa: [], autoridad: true };
 expect(matchingEventualRecipient({ ...snapshot, autoridad: true }, authority)).toEqual(authority);
 expect(matchingEventualRecipient({ ...snapshot, autoridad: true }, { ...authority, autoridad: false })).toBeNull();
});
it('does not repeat an eventual reference or private text in a mutation response', () => {
 const notice = { usuarioId:'person', manifiestoId:null, tipo:'INFO_GENERAL', titulo:'Privado', mensaje:'BI-secret', datos:JSON.stringify({ tipo:'manifiesto_eventual' }) };
 const masked = maskEventualNotice(notice);
 expect(JSON.stringify(masked)).not.toContain('BI-secret'); expect(masked.titulo).toBe('Aviso no disponible');
});
