import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),save:vi.fn(),clear:vi.fn()}));
vi.mock('../../services/api',()=>({api:{get:mocks.get}}));
vi.mock('../../services/companyContext',async orig=>({...await orig<typeof import('../../services/companyContext')>(),saveCompanyContext:mocks.save}));
vi.mock('../../services/offlineSession',()=>({clearOfflineSession:mocks.clear}));
import CompanyNoticeAction from '../../components/CompanyNoticeAction';
import { resolveNotificationPath } from '../../utils/notificationNavigation';
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
