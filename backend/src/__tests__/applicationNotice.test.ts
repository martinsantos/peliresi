import { describe, it, expect, vi } from 'vitest';
import { APPLICATION_NOTICE_LABELS, applicationNoticeContent, applicationNoticeMessage, withApplicationNoticeContext } from '../services/applicationNotice.service';
import { notificationMailContent } from '../services/notification-mail.service';
describe('application notification context',()=>{
 it.each(Object.keys(APPLICATION_NOTICE_LABELS).flatMap(kind=>['GENERADOR','TRANSPORTISTA','OPERADOR'].map(role=>[kind,role])))('%s identifies %s in inbox and rendered mail', (kind,role)=>{
  const n=applicationNoticeContent(kind,{id:'application-qa',tipoActor:role});
  const data=JSON.parse(n.datos);expect(data.tipoActor).toBe(role);expect(data.solicitudId).toBe('application-qa');
  expect(n.titulo).toContain({GENERADOR:'Generador',TRANSPORTISTA:'Transportista',OPERADOR:'Operador'}[role]!);
  const mail=notificationMailContent({id:'notice',tipo:kind,datos:JSON.stringify({...data,observaciones:'PRIVATE',motivoRechazo:'SECRET'}),rol:'GENERADOR',usuarioId:'owner',email:'qa@night-qa.invalid',activo:true,emailVerified:true,notifEmail:true,createdAt:new Date()});
  expect(mail?.subject).toContain(n.titulo);expect(mail?.html).not.toMatch(/PRIVATE|SECRET/);expect(mail?.html).toContain('/mi-solicitud?solicitud=application-qa');
 });
 it('enriches a page in one bounded read without changing its records',async()=>{
  const notices=['g','t','o'].map(id=>({tipo:'SOLICITUD_APROBADA',datos:JSON.stringify({solicitudId:id}),titulo:'Anterior'}));
  const copy=JSON.stringify(notices),findMany=vi.fn().mockResolvedValue([{id:'g',tipoActor:'GENERADOR'},{id:'t',tipoActor:'TRANSPORTISTA'},{id:'o',tipoActor:'OPERADOR'}]);
  const rows=await withApplicationNoticeContext({solicitudInscripcion:{findMany}},notices);
  expect(findMany).toHaveBeenCalledTimes(1);expect(findMany).toHaveBeenCalledWith({where:{id:{in:['g','t','o']}},select:{id:true,tipoActor:true,usuario:{select:{nombre:true}}}});
  expect(rows.map(n=>n.titulo)).toEqual(['Inscripción aprobada · Generador','Inscripción aprobada · Transportista','Inscripción aprobada · Operador']);
  expect(JSON.stringify(notices)).toBe(copy);
 });
 it('does not invent a role or request unrelated/malformed references',async()=>{
  const rows=[{tipo:'INFO_GENERAL',datos:'{"solicitudId":"private"}'},{tipo:'SOLICITUD_APROBADA',datos:'bad-json'},{tipo:'SOLICITUD_APROBADA',datos:'{"solicitudId":"//outside"}'}];
  expect(await withApplicationNoticeContext({},rows)).toEqual(rows);
  expect(applicationNoticeMessage('SOLICITUD_APROBADA',{solicitudId:'own',tipoActor:'ADMIN'})).toBeUndefined();
  const missing={tipo:'SOLICITUD_APROBADA',datos:'{"solicitudId":"missing"}'};
  expect((await withApplicationNoticeContext({solicitudInscripcion:{findMany:vi.fn().mockResolvedValue([])}},[missing]))[0]).toBe(missing);
 });
 it('uses the creation snapshot without reading the application',async()=>{
  const content=applicationNoticeContent('SOLICITUD_MENSAJE',{id:'known',tipoActor:'OPERADOR',usuario:{nombre:'Solicitante QA'}});
  expect(content.mensaje).toContain('Solicitante QA.');
  expect((await withApplicationNoticeContext({},[{tipo:'SOLICITUD_MENSAJE',...content}]))[0].titulo).toBe(content.titulo);
 });
});
