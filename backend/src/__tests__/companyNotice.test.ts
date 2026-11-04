import { describe, it, expect, vi } from 'vitest';
import { companyEventNotices, companyNoticeEligible, COMPANY_NOTICE_LABELS, validCompanyNotice, companyNoticeMessage, withCompanyNoticeContext } from '../services/companyNotice.service';
import { notificationMailContent } from '../services/notification-mail.service';
const event={id:'event',empresaId:'company',tipo:'PERSONA_AUTORIZADA',datos:{despues:{usuarioId:'member',actividadId:'activity',todosEstablecimientos:false},motivo:'PRIVATE',token:'SECRET'}};
const data={tipo:'representacion_empresa',version:1,empresaId:'company',eventoId:'event',evento:'PERSONA_AUTORIZADA'};
function contextDb() {
 return {
  empresa:{findMany:vi.fn().mockResolvedValue([{id:'company',razonSocial:'Empresa de práctica'}])},
  empresaActividad:{findMany:vi.fn().mockResolvedValue([{id:'activity',empresaId:'company',rol:'GENERADOR'}])},
  usuario:{findMany:vi.fn().mockResolvedValue([{id:'owner',nombre:'Titular QA'},{id:'member',nombre:'Segunda persona QA'}])},
  eventoEmpresa:{findMany:vi.fn().mockResolvedValue([event])},
  invitacionEmpresa:{findMany:vi.fn().mockResolvedValue([])},
 };
}
describe('company notices',()=>{
 it('deduplicates a responsible who is also the affected person, without secrets',async()=>{
  const db={...contextDb(),responsableEmpresa:{findMany:vi.fn().mockResolvedValue([{usuarioId:'owner'},{usuarioId:'member'}])},notificacion:{createMany:vi.fn()}};
  await companyEventNotices(db,event);expect(db.usuario.findMany.mock.calls[0][0].where.id.in).toEqual(['owner','member']);
  const rows=db.notificacion.createMany.mock.calls[0][0].data;expect(rows).toHaveLength(2);expect(JSON.stringify(rows)).not.toMatch(/SECRET|PRIVATE/);expect(JSON.parse(rows[0].datos)).toMatchObject(data);
  expect(rows[0].titulo).toBe('Acceso autorizado · Generador');
  expect(rows[0].mensaje).toContain('Empresa de práctica. El acceso de Segunda persona QA');
  expect(rows[1].mensaje).toContain('Empresa de práctica. Tu acceso');
  expect(rows[1].mensaje).toContain('Sólo los establecimientos seleccionados.');
 });
 it('projects old notices in batches without changing persisted content or other event families',async()=>{
  const db=contextDb(), original=[{usuarioId:'member',datos:JSON.stringify(data),titulo:'Anterior',mensaje:'Anterior'}, {usuarioId:'owner',datos:JSON.stringify(data),titulo:'Anterior',mensaje:'Anterior'}, {usuarioId:'owner',datos:'bad json',titulo:'Otro',mensaje:'Otro'}];
  const before=JSON.stringify(original), rows=await withCompanyNoticeContext(db,original);
  expect(JSON.stringify(original)).toBe(before);expect(rows[2]).toBe(original[2]);
  expect(rows[0].mensaje).toContain('Tu acceso');expect(rows[1].mensaje).toContain('Segunda persona QA');
  expect(JSON.parse(rows[0].datos).contextoReconstruido).toBe(true);
  for(const query of [db.empresa.findMany,db.empresaActividad.findMany,db.usuario.findMany,db.eventoEmpresa.findMany])expect(query).toHaveBeenCalledTimes(1);
  expect(db.eventoEmpresa.findMany.mock.calls[0][0].where.OR[0]).toEqual({id:'event',empresaId:'company',tipo:'PERSONA_AUTORIZADA'});
 });
 it('does not enrich a mismatched event or borrow a role from another company',async()=>{
  const db=contextDb(), notice={usuarioId:'member',datos:JSON.stringify({...data,empresaId:'different'})};
  expect((await withCompanyNoticeContext(db,[notice]))[0]).toBe(notice);
  db.empresaActividad.findMany.mockResolvedValue([{id:'activity',empresaId:'different',rol:'OPERADOR'}]);
  const [row]=await withCompanyNoticeContext(db,[{usuarioId:'member',datos:JSON.stringify(data)}]);
  expect(JSON.parse(row.datos).contexto.actividad).toBeUndefined();
 });
 it('preserves an existing snapshot and skips queries when no legacy company notice needs context',async()=>{
  const notice={datos:JSON.stringify({...data,contexto:{empresa:'Original'}})};
  expect((await withCompanyNoticeContext({},[notice]))[0]).toBe(notice);
  expect(await withCompanyNoticeContext({},[{datos:null},{datos:'{"tipo":"other"}'}])).toHaveLength(2);
 });
 it('resolves invitation activity and person without exposing its email or token',async()=>{
  const db=contextDb();db.eventoEmpresa.findMany.mockResolvedValue([{...event,tipo:'INVITACION_ACEPTADA',datos:{invitacionId:'inv'}}] as never);
  db.invitacionEmpresa.findMany.mockResolvedValue([{id:'inv',empresaId:'company',actividadId:'activity',aceptadaPor:'member',todosEstablecimientos:true,email:'PRIVATE',tokenHash:'SECRET'}] as never);
  const [row]=await withCompanyNoticeContext(db,[{usuarioId:'member',datos:JSON.stringify({...data,evento:'INVITACION_ACEPTADA'})}]);
  expect(JSON.parse(row.datos).contexto).toMatchObject({actividad:'GENERADOR',persona:'Segunda persona QA',paraMi:true,alcance:'TODOS'});
  expect(JSON.stringify(row)).not.toMatch(/PRIVATE|SECRET/);
 });
 it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('renders %s mail with the same context, escaped names and no delivery',role=>{
  const contextual={...data,contexto:{empresa:'QA <img src=x onerror=bad> & Cía',actividad:role,persona:'<script>bad</script>',paraMi:false,alcance:'TODOS'},motivo:'PRIVATE',token:'SECRET'};
  const message=companyNoticeMessage(contextual)!;
  const mail=notificationMailContent({id:'notice',tipo:'INFO_GENERAL',datos:JSON.stringify(contextual),createdAt:new Date(),email:'person@qa.invalid',activo:true,emailVerified:true,notifEmail:true,rol:'GENERADOR',usuarioId:'owner'});
  expect(mail?.subject).toContain(message[0]);expect(mail?.html).toContain('QA &lt;img');expect(mail?.html).toContain('&lt;script&gt;');
  expect(mail?.html).toContain('Todos los establecimientos.');expect(mail?.html).not.toMatch(/<script>|<img src=x|PRIVATE|SECRET/);
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

import { withCompanyHistoryContext } from '../services/companyNotice.service';
describe('manager company history',()=>{
 it('distinguishes the author from the affected person and reuses company-scoped context without audit writes',async()=>{
  const db=contextDb(),events=[{...event,usuarioId:'owner'}, {...event,id:'second',usuarioId:'owner'}],before=JSON.stringify(events);
  const rows=await withCompanyHistoryContext(db,events);
  expect(rows[0].presentacion).toEqual({titulo:'Acceso autorizado',autor:'Titular QA',persona:'Segunda persona QA',actividad:'Generador',establecimiento:null});
  expect(JSON.stringify(events)).toBe(before);expect(rows[0].datos).toEqual(event.datos);
  expect(db.usuario.findMany).toHaveBeenCalledTimes(2);
  for(const [query] of db.usuario.findMany.mock.calls)expect(query.select).toEqual({id:true,nombre:true});
  expect(db.empresaActividad.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:{in:['activity']},empresaId:{in:['company']}}}));
  expect(JSON.stringify(rows[0].presentacion)).not.toMatch(/SECRET|PRIVATE|token|email/);
 });
 it('keeps missing accounts explicit without inventing an automated author, and does not expose unknown codes',async()=>{
  const db=contextDb();db.usuario.findMany.mockResolvedValue([]);
  const rows=await withCompanyHistoryContext(db,[{...event,usuarioId:'gone',tipo:'UNKNOWN_INTERNAL_CODE',datos:{}}]);
  expect(rows[0].presentacion).toMatchObject({titulo:'Cambio registrado',autor:null,persona:null,actividad:null});
 });
 it('uses a neutral label for an approved application and the recorded site name for site events',async()=>{
  const rows=await withCompanyHistoryContext(contextDb(),[
   {...event,usuarioId:'owner',tipo:'ALTA_VINCULADA'},
   {...event,id:'site',usuarioId:'owner',tipo:'ESTABLECIMIENTO_CREADO',datos:{despues:{nombre:'  Sede\nNorte  '}}},
   {...event,id:'created',usuarioId:null,tipo:'EMPRESA_CREADA',datos:{}},
  ]);
  expect(rows.map(r=>r.presentacion.titulo)).toEqual(['Inscripción aprobada y vinculada','Establecimiento registrado','Empresa registrada']);
  expect(rows[1].presentacion.establecimiento).toBe('Sede Norte');expect(rows[2].presentacion.autor).toBeNull();
 });
 it('does not query names or context for empty history',async()=>{
  const db=contextDb();expect(await withCompanyHistoryContext(db,[])).toEqual([]);
  expect(db.usuario.findMany).not.toHaveBeenCalled();expect(db.empresa.findMany).not.toHaveBeenCalled();
 });
 it('never resolves a role from a different company',async()=>{
  const db=contextDb();db.empresaActividad.findMany.mockResolvedValue([{id:'activity',empresaId:'foreign',rol:'OPERADOR'}]);
  const [row]=await withCompanyHistoryContext(db,[{...event,usuarioId:'owner'}]);expect(row.presentacion.actividad).toBeNull();
 });
});
