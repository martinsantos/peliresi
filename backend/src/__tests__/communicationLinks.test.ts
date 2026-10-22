import { afterEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('../lib/prisma', () => ({ default: { notificacion: { findFirst: db.findFirst } } }));
import { mailAction, renderMail, renderDigest } from '../services/email-templates';
import { notificationMailContent } from '../services/notification-mail.service';
import { signatureReminderPhase } from '../jobs/manifestSignatureReminder.job';
import { getNotificacion } from '../controllers/notification.controller';
afterEach(() => vi.unstubAllEnvs());
describe('communication links', () => {
  it.each(['/manifiestos/m?certificado=c#certificaciones', '/manifiestos/m/adendas?adenda=a', '/mis-inspecciones/i#intercambios', '/soporte/s', '/mi-solicitud?solicitud=s', '/app/notificaciones/n'])('app first and identical explicit web fallback: %s', path => {
    vi.stubEnv('FRONTEND_URL', 'https://sitrep.example.invalid');
    const html = mailAction(path, 'Abrir');
    const urls = [...html.matchAll(/href="([^"]+)"/g)].map(m => new URL(m[1]));
    expect(urls).toHaveLength(2); expect(urls[0].origin).toBe(urls[1].origin);
    expect(urls[0].pathname).toBe('/app' + urls[1].pathname);
    expect(urls[0].search + urls[0].hash).toBe(urls[1].search + urls[1].hash);
  });
  it.each(['//other.invalid','/\\other.invalid','/\nother.invalid','/x/%2f../outside'])('rejects an unsafe destination: %s', path => expect(() => mailAction(path, 'Abrir')).toThrow());
  it('preserves encoded auth tokens without using them as paths', () => {
    const mail = renderMail('verify', { name: 'QA', token: 'a/b+c&d' });
    expect(mail.html).toContain('token=a%2Fb%2Bc%26d');
  });
  it.each(['EN_TRATAMIENTO', 'CANCELADO'])('covers intermediate event %s with a real destination', estado => {
    const mail = notificationMailContent({ id:'n',tipo:'INFO_GENERAL',manifiestoId:'m',datos:JSON.stringify({tipo:'estado_manifiesto',estado}),rol:'GENERADOR' } as any)!;
    expect(mail.family).toBe('manifiestos'); expect(mail.html).toContain('/app/manifiestos/m');
    expect(mail.subject).not.toContain('Novedad');
  });
  it('selects the exact application, avoiding another activity of the same applicant', () => {
    const mail = notificationMailContent({id:'n',tipo:'SOLICITUD_MENSAJE',datos:'{"solicitudId":"second"}',rol:'GENERADOR'} as any)!;
    expect(mail.html).toContain('/app/mi-solicitud?solicitud=second');
  });
  it('uses a stable individual notice when no dossier exists', () => {
    expect(notificationMailContent({id:'old',tipo:'ALERTA_SISTEMA',datos:'{}',rol:'GENERADOR'} as any)!.html).toContain('/app/notificaciones/old');
  });
  it('keeps a valid link per digest item and rejects a hostile old link', () => {
    const html = renderDigest([{subject:'One',html:mailAction('/soporte/t','Abrir')},{subject:'Two',html:'<a href="https://other.invalid">Bad</a>'}]);
    expect(html).toContain('/app/soporte/t');expect(html).toContain('/app/notificaciones');expect(html).not.toContain('other.invalid');
  });
  it('only new authority notices get a mail contract; old internal notices remain internal',()=>{
    const n={id:'n',tipo:'INFO_GENERAL',manifiestoId:'m',rol:'ADMIN',datos:JSON.stringify({tipo:'ADENDA_POST_FACTO',adendaId:'a'})};
    expect(notificationMailContent(n as any)).toBeNull();
    expect(notificationMailContent({...n,datos:JSON.stringify({tipo:'ADENDA_POST_FACTO',correoVersion:1,adendaId:'a'})} as any)?.html).toContain('/app/manifiestos/m/adendas?adenda=a');
  });
  it('reads only the recipient notice, without marking, deleting or disclosing another account', async () => {
    const json=vi.fn(),setHeader=vi.fn(),next=vi.fn();db.findFirst.mockResolvedValue(null);
    await getNotificacion({params:{id:'foreign'},user:{id:'self',rol:'ADMIN'}} as any,{json,setHeader} as any,next);
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'foreign',usuarioId:'self'}}));
    expect(json).not.toHaveBeenCalled(); expect(next.mock.calls[0][0].statusCode).toBe(404);
    db.findFirst.mockResolvedValue({id:'mine',leida:false}); next.mockClear();
    await getNotificacion({params:{id:'mine'},user:{id:'self'}} as any,{json,setHeader} as any,next);
    expect(json).toHaveBeenCalledWith({success:true,data:{id:'mine',leida:false}});expect(next).not.toHaveBeenCalled();
  });
});
describe('signature reminder boundaries (not receipt)', () => {
  const signed=new Date('2026-09-22T12:00:00Z');
  it.each([[22.999,null],[23,'SEMANA'],[29.999,'SEMANA'],[30,'TREINTA_DIAS'],[45,'TREINTA_DIAS'],[-1,null]])('%s elapsed days -> %s',(days,phase)=>{
    expect(signatureReminderPhase(signed,'RECIBIDO',new Date(+signed+Number(days)*86400000))).toBe(phase);
  });
  it.each(['BORRADOR','PENDIENTE_APROBACION','TRATADO','CANCELADO','RECHAZADO'])('suppresses %s',state=>expect(signatureReminderPhase(signed,state,new Date('2026-10-23'))).toBeNull());
  it('does not invent a signature date',()=>expect(signatureReminderPhase(null,'RECIBIDO',new Date())).toBeNull());
});
