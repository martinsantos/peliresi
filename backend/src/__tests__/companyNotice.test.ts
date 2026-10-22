import { describe, it, expect, vi } from 'vitest';
import { companyEventNotices, companyNoticeEligible, COMPANY_NOTICE_LABELS, validCompanyNotice } from '../services/companyNotice.service';
import { notificationMailContent } from '../services/notification-mail.service';
const event={id:'event',empresaId:'company',tipo:'PERSONA_AUTORIZADA',datos:{despues:{usuarioId:'member'},motivo:'PRIVATE',token:'SECRET'}};
const data={tipo:'representacion_empresa',version:1,empresaId:'company',eventoId:'event',evento:'PERSONA_AUTORIZADA'};
describe('company notices',()=>{
 it('deduplicates a responsible who is also the affected person, without secrets',async()=>{
  const db={responsableEmpresa:{findMany:vi.fn().mockResolvedValue([{usuarioId:'owner'},{usuarioId:'member'}])},usuario:{findMany:vi.fn().mockResolvedValue([{id:'owner'},{id:'member'}])},notificacion:{createMany:vi.fn()}};
  await companyEventNotices(db,event);expect(db.usuario.findMany.mock.calls[0][0].where.id.in).toEqual(['owner','member']);
  const rows=db.notificacion.createMany.mock.calls[0][0].data;expect(rows).toHaveLength(2);expect(JSON.stringify(rows)).not.toMatch(/SECRET|PRIVATE/);expect(JSON.parse(rows[0].datos)).toEqual(data);
 });
 it('requires a known version, IDs and event',()=>{expect(validCompanyNotice(data)).toBe(true);for(const change of [{version:2},{empresaId:'//elsewhere'},{evento:'invented'},{eventoId:''}])expect(validCompanyNotice({...data,...change})).toBe(false);});
 it('suppresses stale access notices after revocation but retains the revocation notice for its owner',async()=>{
  const db={eventoEmpresa:{findFirst:vi.fn().mockResolvedValue(event)},empresa:{findUnique:vi.fn().mockResolvedValue({activa:true})},responsableEmpresa:{findFirst:vi.fn().mockResolvedValue(null)},autorizacionEmpresa:{findFirst:vi.fn().mockResolvedValue(null)}};
  expect(await companyNoticeEligible(db,'member',data)).toBe(false);
  db.eventoEmpresa.findFirst.mockResolvedValue({...event,tipo:'PERSONA_REVOCADA',datos:{antes:{usuarioId:'member'}}} as never);
  expect(await companyNoticeEligible(db,'member',{...data,evento:'PERSONA_REVOCADA'})).toBe(true);expect(await companyNoticeEligible(db,'outsider',{...data,evento:'PERSONA_REVOCADA'})).toBe(false);
 });
 it.each(Object.keys(COMPANY_NOTICE_LABELS))('renders a controlled %s email without sending', kind=>{
  const mail=notificationMailContent({id:'notice',tipo:'INFO_GENERAL',datos:JSON.stringify({...data,evento:kind,motivo:'PRIVATE',token:'SECRET'}),createdAt:new Date(),email:'person@qa.invalid',activo:true,emailVerified:true,notifEmail:true,rol:'GENERADOR',usuarioId:'member'});
  expect(mail?.family).toBe('representacion');expect(mail?.html).toContain(COMPANY_NOTICE_LABELS[kind][0]);expect(mail?.html).not.toMatch(/PRIVATE|SECRET/);expect(mail?.html).toContain(kind.includes('REVOCAD')?'/notificaciones':'/empresas?empresa=company');
 });
});
