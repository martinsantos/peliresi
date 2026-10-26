import { beforeEach, expect, it, vi } from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TrainingCertificates} from '../../pages/manifiestos/components/TrainingCertificates';
const mocks=vi.hoisted(()=>({impersonated:false,restricted:false,rows:new Map<string,any>(),get:vi.fn(),post:vi.fn(),user:{id:'o',rol:'OPERADOR',actorId:'o',training:false}}));
vi.mock('../../services/api',()=>({api:{get:mocks.get,post:mocks.post}}));
vi.mock('../../utils/supportSession',()=>({supportSessionMatches:()=>true,supportRequestContext:()=> 'operator-context'}));
vi.mock('../../services/supportCommandStore',()=>({readSupportCommandRecord:async(k:string)=>mocks.rows.get(k)||null,updateSupportCommandRecord:async(k:string,change:any)=>{const next=change(mocks.rows.get(k)||null);if(next)mocks.rows.set(k,next);else mocks.rows.delete(k);return next;}}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:mocks.user,isRestricted:mocks.restricted})}));
vi.mock('../../contexts/ImpersonationContext',()=>({useImpersonation:()=>({impersonationData:mocks.impersonated?{userId:'admin'}:null})}));
vi.mock('../../components/ui/SignaturePad',()=>({SignaturePad:({onConfirm}:any)=><button type="button" onClick={()=>onConfirm('test-signature')}>Use QA signature</button>}));
beforeEach(()=>{vi.clearAllMocks();mocks.rows.clear();mocks.impersonated=false;mocks.restricted=false;mocks.user={id:'o',rol:'OPERADOR',actorId:'o',training:false};});
const m:any={id:'m',numero:'M',estado:'TRATADO',operadorId:'o',tratamientoMetodo:'Tratamiento registrado',residuos:[{id:'r',cantidadRecibida:10,unidad:'kg',tipoResiduo:{codigo:'Y1'}}]};
function show(){const q=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<MemoryRouter><QueryClientProvider client={q}><TrainingCertificates manifest={m}/></QueryClientProvider></MemoryRouter>);}
it('prefills remaining partial quantities and method, retains form after a failed issue',async()=>{
 mocks.get.mockResolvedValue({data:{data:[{id:'c',createdAt:'2026-10-21T10:00:00Z',documento:{tipo:'PARCIAL',cantidades:[{residuoId:'r',cantidad:4,corriente:'Y1',unidad:'kg'}]}}],emisionHabilitada:true,adendasSinResolver:0}});
 mocks.post.mockRejectedValue({response:{data:{message:'Servicio no disponible'}}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));
 expect(screen.getByLabelText('Cantidad a certificar Y1 (kg)')).toHaveValue(6);
 expect(screen.getByLabelText('Método de tratamiento certificado')).toHaveValue('Tratamiento registrado');
 fireEvent.click(screen.getByText('Use QA signature'));fireEvent.click(screen.getByText('Firmar y publicar certificación'));
 await screen.findByText('Servicio no disponible');expect(screen.getByText(/Y1: 6 kg/)).toBeVisible();
 fireEvent.click(screen.getByText('Reintentar misma emisión'));await waitFor(()=>expect(mocks.post).toHaveBeenCalledTimes(2));
 expect(mocks.post.mock.calls[0][1].id).toBe(mocks.post.mock.calls[1][1].id);
});
it('a counterpart sees released documents, never emission controls',async()=>{
 mocks.user={id:'g',rol:'GENERADOR',actorId:'g',training:false};mocks.get.mockResolvedValue({data:{data:[{id:'f',numero:'M-F',createdAt:'2026-10-21T10:00:00Z',documento:{tipo:'FINAL',cantidades:[{residuoId:'r',cantidad:10,corriente:'Y1',unidad:'kg'}]}}],emisionHabilitada:true,adendasSinResolver:0}});
 show();await screen.findByRole('button',{name:'Descargar final'});expect(screen.queryByText('Emitir certificación parcial')).toBeNull();expect(screen.getByText(/M-F/)).toBeVisible();
});
it('turning off emission preserves downloadable documents and explains the restriction',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:false,adendasSinResolver:0}});show();await screen.findByText(/La emisión está deshabilitada/);expect(screen.queryByRole('button',{name:'Emitir certificación parcial'})).toBeNull();
});
it('an unresolved addendum disables final emission without disabling partials',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:1}});show();expect(await screen.findByRole('button',{name:'Emitir certificación final total'})).toBeDisabled();expect(screen.getByRole('button',{name:'Emitir certificación parcial'})).toBeEnabled();
});

it('never carries a certificate form or cached documents into another role of the same account',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const tree=()=> <MemoryRouter><QueryClientProvider client={q}><TrainingCertificates manifest={m}/></QueryClientProvider></MemoryRouter>;
 const view=render(tree());fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));
 fireEvent.change(screen.getByLabelText('Observaciones del certificado (opcional)'),{target:{value:'Nota del operador'}});
 mocks.user={...mocks.user,rol:'GENERADOR',actorId:'g'};mocks.get.mockReturnValue(new Promise(()=>{}));view.rerender(tree());
 expect(screen.queryByLabelText('Observaciones del certificado (opcional)')).toBeNull();
 expect(screen.queryByText('Lista para firmar')).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('Comprobando certificados');
 expect(mocks.post).not.toHaveBeenCalled();q.clear();
});

it('blocks issue after a refresh failure and preserves entered data until retry succeeds',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación final total'}));
 fireEvent.change(screen.getByLabelText('Observaciones del certificado (opcional)'),{target:{value:'Mi nota conservada'}});
 fireEvent.click(screen.getByText('Use QA signature'));
 mocks.get.mockRejectedValue(new Error('Offline'));
 fireEvent.click(screen.getByRole('button',{name:'Actualizar certificados'}));
 await screen.findByText(/No se pudieron comprobar los certificados/);
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();expect(mocks.post).not.toHaveBeenCalled();
 expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toHaveValue('Mi nota conservada');
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});
 fireEvent.click(screen.getByRole('button',{name:'Reintentar certificados'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeEnabled());
 expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toHaveValue('Mi nota conservada');
});

it.each(['impersonated','restricted'] as const)('does not expose signing or local operator recovery in %s mode',async mode=>{
 mocks[mode]=true;mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});
 show();await screen.findByText(/Esta vista permite consultar certificados/);
 expect(screen.queryByRole('button',{name:'Emitir certificación parcial'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Comprobar resultado'})).toBeNull();expect(mocks.post).not.toHaveBeenCalled();
});
