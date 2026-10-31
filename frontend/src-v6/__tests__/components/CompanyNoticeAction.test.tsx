import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),save:vi.fn(),clear:vi.fn()}));
vi.mock('../../services/api',()=>({api:{get:mocks.get}}));
vi.mock('../../services/companyContext',async orig=>({...await orig<typeof import('../../services/companyContext')>(),saveCompanyContext:mocks.save}));
vi.mock('../../services/offlineSession',()=>({clearOfflineSession:mocks.clear}));
import CompanyNoticeAction from '../../components/CompanyNoticeAction';
import { notificationCompanyAccesses, resolveNotificationPath } from '../../utils/notificationNavigation';
const access={empresaId:'co',actividadId:'a',rol:'GENERADOR',razonSocial:'QA Entidad',establecimientoId:'site',establecimiento:'Norte'};
const notice:any={id:'n',datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:'cert',tipoCertificado:'FINAL',accesosEmpresa:[access]}),manifiestoId:'m'};
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
function show(prefix=''){return render(<MemoryRouter initialEntries={[prefix+'/notificaciones/n']}><CompanyNoticeAction notice={notice} target="/manifiestos/m?certificado=cert#certificaciones" userId="rep"/></MemoryRouter>);}
it.each(['','/app'])('routes the notice before the dossier and identifies company/activity/site in %s',prefix=>{
 expect(resolveNotificationPath(notice,prefix)).toBe(prefix+'/notificaciones/n');
 expect(resolveNotificationPath(notice,prefix,undefined,true)).toBe(prefix+'/manifiestos/m?certificado=cert#certificaciones');
 show(prefix);expect(screen.getByText('QA Entidad')).toBeVisible();expect(screen.getByText('Generador · Norte')).toBeVisible();
 expect(mocks.get).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it('keeps the previous context after a revoked grant, then allows a deliberate retry',async()=>{
 mocks.get.mockRejectedValue(new Error('403'));show();
 fireEvent.click(screen.getByRole('button',{name:'Usar Generador y abrir certificado'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu contexto no cambió');
 expect(mocks.get).toHaveBeenCalledWith('/auth/profile',{headers:{'X-SITREP-Empresa':'co','X-SITREP-Empresa-Actividad':'a','X-SITREP-Establecimiento':'site'}});
 expect(mocks.save).not.toHaveBeenCalled();expect(mocks.clear).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Usar Generador y abrir certificado'}));await waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(2));
});
it.each(['other-user','other-activity','other-site','other-role'])('rejects a mismatched fresh profile: %s',async kind=>{
 const user:any={id:'rep',empresaContexto:{...access}};
 if(kind==='other-user')user.id='another';
 if(kind==='other-activity')user.empresaContexto.actividadId='elsewhere';
 if(kind==='other-site')user.empresaContexto.establecimientoId='elsewhere';
 if(kind==='other-role')user.empresaContexto.rol='OPERADOR';
 mocks.get.mockResolvedValue({data:{data:{user}}});show();fireEvent.click(screen.getByRole('button',{name:'Usar Generador y abrir certificado'}));
 await screen.findByRole('alert');expect(mocks.save).not.toHaveBeenCalled();
});
it('ignores a late validation after leaving the account screen and blocks double click',async()=>{
 let finish:(v:any)=>void=()=>{};mocks.get.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const view=show();const button=screen.getByRole('button',{name:'Usar Generador y abrir certificado'});fireEvent.click(button);fireEvent.click(button);
 expect(mocks.get).toHaveBeenCalledTimes(1);view.unmount();
 finish({data:{data:{user:{id:'rep',empresaContexto:access}}}});await Promise.resolve();await Promise.resolve();
 expect(mocks.save).not.toHaveBeenCalled();
});

it.each(['propuesta_partes','adenda_manifiesto'])('uses a specific action and preserves the object for %s in web and app',tipo=>{
 const target=tipo==='adenda_manifiesto'?'/manifiestos/m/adendas?adenda=annex':'/manifiestos/m';
 const subject=tipo==='adenda_manifiesto'?'adenda':'manifiesto';
 const n={...notice,datos:JSON.stringify({tipo,version:1,adendaId:'annex',url:target,accesosEmpresa:[access]})};
 for(const prefix of ['', '/app']){
  expect(resolveNotificationPath(n,prefix)).toBe(prefix+'/notificaciones/n');
  expect(resolveNotificationPath(n,prefix,undefined,true)).toBe(prefix+target);
 }
 render(<MemoryRouter><CompanyNoticeAction notice={n} target={target} userId="rep"/></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Usar Generador y abrir '+subject})).toBeVisible();
 expect(screen.queryByRole('button',{name:/certificado/})).toBeNull();
 expect(mocks.get).not.toHaveBeenCalled();
});
it('opens a representative reversion through the verified company context in web and app', () => {
 const n = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ tipo: 'reversion_manifiesto', version: 1, destino: 'representante', accesosEmpresa: [access] }) };
 for (const prefix of ['', '/app']) {
  expect(resolveNotificationPath(n, prefix)).toBe(prefix + '/notificaciones/n');
  expect(resolveNotificationPath(n, prefix, undefined, true)).toBe(prefix + '/manifiestos/m');
 }
 expect(notificationCompanyAccesses(n)).toEqual([access]);
});

it.each(['duracion_transito_configurada', 'alerta_regla_manifiesto'])('opens a configured rule through the verified company context in web and app: %s', tipo => {
 const n = { ...notice, tipo: 'ALERTA_SISTEMA', datos: JSON.stringify({ tipo, version: 1, destino: 'representante', accesosEmpresa: [access], url: '/wrong' }) };
 for (const prefix of ['', '/app']) {
  expect(resolveNotificationPath(n, prefix)).toBe(prefix + '/notificaciones/n');
  expect(resolveNotificationPath(n, prefix, undefined, true)).toBe(prefix + '/manifiestos/m');
 }
 render(<MemoryRouter><CompanyNoticeAction notice={n} target="/manifiestos/m" userId="rep" /></MemoryRouter>);
 expect(screen.getByRole('button', { name: 'Usar Generador y abrir manifiesto' })).toBeVisible();
 expect(mocks.get).not.toHaveBeenCalled();
 expect(notificationCompanyAccesses({ ...n, tipo: 'INFO_GENERAL' })).toEqual([]);
});

it.each([
 ['INCIDENTE', 'INCIDENTE_REPORTADO'], ['RECHAZO', 'MANIFIESTO_RECHAZADO'], ['DIFERENCIA_PESO', 'ALERTA_SISTEMA'], ['ENTREGA', 'MANIFIESTO_ENTREGADO'],
])('opens a representative operational event %s through the owned notice', (evento, tipo) => {
 const n = { ...notice, tipo, datos: JSON.stringify({ tipo: 'alerta_evento_manifiesto', version: 1, destino: 'representante', evento, accesosEmpresa: [access] }) };
 for (const prefix of ['', '/app']) {
  expect(resolveNotificationPath(n, prefix)).toBe(prefix + '/notificaciones/n');
  expect(resolveNotificationPath(n, prefix, undefined, true)).toBe(prefix + '/manifiestos/m');
 }
 expect(notificationCompanyAccesses({ ...n, tipo: 'INFO_GENERAL' })).toEqual([]);
});

it.each([
 ['EN_TRANSITO', 'MANIFIESTO_EN_TRANSITO'], ['ENTREGADO', 'MANIFIESTO_ENTREGADO'],
 ['RECIBIDO', 'MANIFIESTO_RECIBIDO'], ['EN_TRATAMIENTO', 'INFO_GENERAL'],
 ['TRATADO', 'MANIFIESTO_TRATADO'], ['CANCELADO', 'INFO_GENERAL'],
])('requires the authorized company context for state notice %s', (estado, tipo) => {
 const n = { ...notice, tipo, datos: JSON.stringify({ tipo: 'estado_manifiesto', version: 1, destino: 'representante', estado, accesosEmpresa: [access] }) };
 for (const prefix of ['', '/app']) {
  expect(resolveNotificationPath(n, prefix)).toBe(prefix + '/notificaciones/n');
  expect(resolveNotificationPath(n, prefix, undefined, true)).toBe(prefix + '/manifiestos/m');
 }
 expect(notificationCompanyAccesses(n)).toEqual([access]);
});

const fiscalNotice:any = { id:'fiscal-n', datos:JSON.stringify({ tipo:'recordatorio_fiscal', version:1, destino:'representante',
 generadorId:'g-1', fiscalYear:2026, accesosEmpresa:[{empresaId:'co',actividadId:'a',rol:'GENERADOR',razonSocial:'QA Entidad'}] }) };
const fiscalTarget='/admin/actores/generadores/g-1?tab=fiscal&ejercicio=2026';
it.each(['', '/app'])('routes an eventual through the owned notice and its company activity in %s', prefix => {
 const n:any = { ...notice, tipo:'INFO_GENERAL', datos:JSON.stringify({ tipo:'manifiesto_eventual',version:1,accesoVersion:1,registroId:'e-1',
  accesosEmpresa:[{empresaId:'co',actividadId:'a',rol:'GENERADOR',actorId:'g-1',razonSocial:'QA Entidad'}] }) };
 expect(resolveNotificationPath(n,prefix)).toBe(prefix+'/notificaciones/n');
 expect(resolveNotificationPath(n,prefix,undefined,true)).toBe(prefix+'/manifiestos/baja-intensidad?registro=e-1');
 render(<MemoryRouter><CompanyNoticeAction notice={n} target="/manifiestos/baja-intensidad?registro=e-1" userId="rep" /></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Abrir eventual como Generador de QA Entidad'})).toBeVisible();
});
it.each(['wrong-actor', 'site-only', 'revoked'])('does not save a company eventual context with %s', async reason => {
 const n:any = { ...notice, tipo:'INFO_GENERAL', datos:JSON.stringify({ tipo:'manifiesto_eventual',version:1,accesoVersion:1,registroId:'e-1',
  accesosEmpresa:[{empresaId:'co',actividadId:'a',rol:'GENERADOR',actorId:'g-1',razonSocial:'QA Entidad'}] }) };
 const context = { empresaId:'co', actividadId:'a', rol:'GENERADOR', actorId:'g-1', todasSedes:true };
 if(reason==='wrong-actor') context.actorId='g-other'; if(reason==='site-only') context.todasSedes=false;
 if(reason==='revoked') mocks.get.mockRejectedValue(new Error('403')); else mocks.get.mockResolvedValue({data:{data:{user:{id:'rep',empresaContexto:context}}}});
 render(<MemoryRouter><CompanyNoticeAction notice={n} target="/manifiestos/baja-intensidad?registro=e-1" userId="rep" /></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Abrir eventual como Generador de QA Entidad'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu contexto no cambió'); expect(mocks.save).not.toHaveBeenCalled();
});
it('groups the activities of one company without repeating its name', () => {
 const n:any = { ...notice, tipo:'INFO_GENERAL', datos:JSON.stringify({ tipo:'manifiesto_eventual',version:1,accesoVersion:1,registroId:'e-1',
  accesosEmpresa:[{empresaId:'co',actividadId:'a',rol:'GENERADOR',actorId:'g-1',razonSocial:'QA Entidad'},
   {empresaId:'co',actividadId:'b',rol:'OPERADOR',actorId:'o-1',razonSocial:'QA Entidad'}] }) };
 render(<MemoryRouter><CompanyNoticeAction notice={n} target="/manifiestos/baja-intensidad?registro=e-1" userId="rep" /></MemoryRouter>);
 expect(screen.getAllByText('QA Entidad')).toHaveLength(1);
 expect(screen.getByRole('button',{name:'Abrir eventual como Generador de QA Entidad'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Abrir eventual como Operador de QA Entidad'})).toBeVisible();
});
it.each(['','/app'])('offers the exact company fiscal record in %s without a personal-role detour', prefix => {
 expect(resolveNotificationPath(fiscalNotice,prefix)).toBe(prefix+'/notificaciones/fiscal-n');
 expect(resolveNotificationPath(fiscalNotice,prefix,undefined,true)).toBe(prefix+fiscalTarget);
 render(<MemoryRouter initialEntries={[prefix+'/notificaciones/fiscal-n']}><CompanyNoticeAction notice={fiscalNotice} target={fiscalTarget} userId="rep"/></MemoryRouter>);
 expect(screen.getByText('QA Entidad')).toBeVisible();
 expect(screen.getByRole('button',{name:'Usar Generador para continuar'})).toBeVisible();
 expect(screen.queryByText(/manifiesto/)).toBeNull();
});
it.each(['wrong-actor','site-only','revoked'])('does not save a fiscal company context with %s', async reason => {
 const context = { empresaId:'co',actividadId:'a',rol:'GENERADOR',actorId:'g-1',todasSedes:true };
 if(reason==='wrong-actor')context.actorId='g-other';
 if(reason==='site-only')context.todasSedes=false;
 if(reason==='revoked')mocks.get.mockRejectedValue(new Error('403'));
 else mocks.get.mockResolvedValue({data:{data:{user:{id:'rep',empresaContexto:context}}}});
 render(<MemoryRouter><CompanyNoticeAction notice={fiscalNotice} target={fiscalTarget} userId="rep"/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Usar Generador para continuar'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu contexto no cambió');
 expect(mocks.save).not.toHaveBeenCalled();
});
it('opens the fiscal page only in the matching full company context', () => {
 const onOpen=vi.fn();
 const context:any = { empresaId:'co',actividadId:'a',rol:'GENERADOR',actorId:'g-1',todasSedes:true };
 render(<MemoryRouter><CompanyNoticeAction notice={fiscalNotice} target={fiscalTarget} userId="rep" context={context} onOpenFiscal={onOpen}/></MemoryRouter>);
 const link=screen.getByRole('link',{name:'Ver situación fiscal →'});
 expect(link).toHaveAttribute('href',fiscalTarget);fireEvent.click(link);expect(onOpen).toHaveBeenCalledOnce();
});

const requirementAccess = { empresaId:'co', actividadId:'a', rol:'GENERADOR', actorId:'g-1', razonSocial:'QA Entidad' };
const requirementNotice:any = { id:'psip-n', tipo:'INFO_GENERAL', datos:JSON.stringify({ tipo:'intercambio_inspeccion', version:1,
 destino:'participacion', tipoActor:'GENERADOR', representacionVersion:1, inspeccionId:'case-1', accesosEmpresa:[requirementAccess] }) };
it.each(['', '/app'])('opens a representative requirement through a deliberate company selection on %s', prefix => {
 expect(resolveNotificationPath(requirementNotice,prefix,'OPERADOR')).toBe(prefix+'/notificaciones/psip-n');
 expect(resolveNotificationPath(requirementNotice,prefix,'OPERADOR',true)).toBe(prefix+'/requerimientos/case-1');
 render(<MemoryRouter><CompanyNoticeAction notice={requirementNotice} target="/requerimientos/case-1" userId="rep" /></MemoryRouter>);
 expect(screen.getByText('QA Entidad')).toBeVisible();
 expect(screen.getByRole('button',{name:'Usar Generador y abrir requerimiento'})).toBeVisible();
 expect(mocks.get).not.toHaveBeenCalled();
});
it.each(['wrong-actor','site-only','wrong-user','revoked'])('does not change context when requirement access is %s', async reason => {
 const user:any = { id:'rep', empresaContexto:{ empresaId:'co', actividadId:'a', rol:'GENERADOR', actorId:'g-1', todasSedes:true } };
 if(reason==='wrong-actor')user.empresaContexto.actorId='g-other';
 if(reason==='site-only')user.empresaContexto.todasSedes=false;
 if(reason==='wrong-user')user.id='other';
 if(reason==='revoked')mocks.get.mockRejectedValue(new Error('403'));
 else mocks.get.mockResolvedValue({data:{data:{user}}});
 render(<MemoryRouter><CompanyNoticeAction notice={requirementNotice} target="/requerimientos/case-1" userId="rep" /></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Usar Generador y abrir requerimiento'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu contexto no cambió');
 expect(mocks.save).not.toHaveBeenCalled();
});
it.each([
 { tipoActor:'OPERADOR' }, { representacionVersion:2 }, { inspeccionId:'../case' },
 { accesosEmpresa:[{ ...requirementAccess, establecimientoId:'site' }] },
 { accesosEmpresa:[{ ...requirementAccess, actorId:'../actor' }] },
])('rejects malformed requirement company metadata: %j', invalid => {
 const data = JSON.parse(requirementNotice.datos);
 expect(notificationCompanyAccesses({ ...requirementNotice, datos:JSON.stringify({ ...data, ...invalid }) })).toEqual([]);
});
