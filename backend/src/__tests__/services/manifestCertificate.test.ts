import { afterEach, describe, expect, it, vi } from 'vitest';
import { certificatesEnabled, notifyCertificateParties, certificateReadiness } from '../../services/manifestCertificate.service';
import { notificationMailContent } from '../../services/notification-mail.service';
vi.mock('../../lib/trainingScope',async importOriginal=>({...await importOriginal<typeof import('../../lib/trainingScope')>(),isTrainingSession:()=>false}));
afterEach(()=>vi.unstubAllEnvs());
describe('Operator-issued certificates',()=>{
 it('emission is explicit opt-in, never assumed',()=>{vi.stubEnv('MANIFEST_CERTIFICATES_ENABLED','false');expect(certificatesEnabled()).toBe(false);vi.stubEnv('MANIFEST_CERTIFICATES_ENABLED','true');expect(certificatesEnabled()).toBe(true);});
 it('notifies only active linked counterparts, no invented in situ carrier or self notice',async()=>{
  vi.stubEnv('ENTERPRISE_ENABLED','false');
  const party=(id:string,activo=true)=>({activo,usuario:{id,activo:true}});
  const tx:any={generador:{findUnique:vi.fn().mockResolvedValue(party('g'))},transportista:{findUnique:vi.fn()},operador:{findUnique:vi.fn().mockResolvedValue(party('o'))},notificacion:{createMany:vi.fn()}};
  const m={id:'m',numero:'M',generadorId:'g',transportistaId:null,operadorId:'o'},d={id:'cert',tipo:'FINAL',numero:'M-F'};
  await notifyCertificateParties(tx,m,d,'o');
  expect(tx.transportista.findUnique).not.toHaveBeenCalled();
  const data=tx.notificacion.createMany.mock.calls[0][0];expect(data.skipDuplicates).toBe(true);expect(data.data).toHaveLength(1);expect(data.data[0].usuarioId).toBe('g');
  expect(JSON.parse(data.data[0].datos)).toMatchObject({tipo:'certificado_manifiesto',version:1,documentoId:'cert',tipoCertificado:'FINAL'});
  tx.generador.findUnique.mockResolvedValue(party('g',false));await notifyCertificateParties(tx,m,d,'o');expect(tx.notificacion.createMany.mock.calls[1][0].data).toHaveLength(0);
 });
 it('pending, observed and rejected addenda block the final; an approved last decision clears its own requirement',async()=>{
  const tx:any={adendaManifiesto:{findMany:vi.fn().mockResolvedValue([{id:'a',version:0,revisiones:[]},{id:'b',version:1,revisiones:[{decision:'OBSERVADA'}]},{id:'c',version:1,revisiones:[{decision:'RECHAZADA'}]},{id:'d',version:2,revisiones:[{decision:'OBSERVADA'},{decision:'APROBADA'}]}])}};
  expect((await certificateReadiness(tx,'m')).unresolved).toBe(3);
 });
 it.each(['PARCIAL','FINAL'])('renders controlled %s email and exact document link without free-text leakage',tipo=>{
  const n:any={tipo:'INFO_GENERAL',manifiestoId:'m',datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:'d',tipoCertificado:tipo,nota:'SECRET'}),createdAt:new Date()};
  const mail=notificationMailContent(n)!;expect(mail.family).toBe('manifiestos');expect(mail.subject).toMatch(tipo==='FINAL'?/final total/:/parcial/);expect(mail.html).toContain('certificado=d');expect(mail.html).not.toContain('SECRET');
  n.datos=JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:'../bad',tipoCertificado:tipo});expect(notificationMailContent(n)).toBeNull();
 });
});
