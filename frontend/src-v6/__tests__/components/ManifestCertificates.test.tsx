vi.mock('../../hooks/useInspectionDraftOwnership',()=>({useInspectionDraftOwnership:(_:string,enabled:boolean)=>({status:enabled?'owned':'unavailable',canWrite:()=>enabled,retry:vi.fn()})}));
import { beforeEach, expect, it, vi } from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TrainingCertificates} from '../../pages/manifiestos/components/TrainingCertificates';
const mocks=vi.hoisted(()=>({gate:null as Promise<void>|null,impersonated:false,restricted:false,rows:new Map<string,any>(),get:vi.fn(),post:vi.fn(),user:{id:'o',rol:'OPERADOR',actorId:'o',training:false}}));
vi.mock('../../services/api',()=>({api:{get:mocks.get,post:mocks.post}}));
vi.mock('../../utils/supportSession',()=>({supportSessionMatches:()=>true,supportRequestContext:()=> 'operator-context'}));
vi.mock('../../services/supportCommandStore',()=>({readSupportCommandRecord:async(k:string)=>mocks.rows.get(k)||null,updateSupportCommandRecord:async(k:string,change:any)=>{if(mocks.gate)await mocks.gate;const next=change(mocks.rows.get(k)||null);if(next)mocks.rows.set(k,next);else mocks.rows.delete(k);return next;}}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:mocks.user,isRestricted:mocks.restricted})}));
vi.mock('../../contexts/ImpersonationContext',()=>({useImpersonation:()=>({impersonationData:mocks.impersonated?{userId:'admin'}:null})}));
vi.mock('../../components/ui/SignaturePad',()=>({SignaturePad:({onConfirm}:any)=><button type="button" onClick={()=>onConfirm('test-signature')}>Use QA signature</button>}));
beforeEach(()=>{vi.clearAllMocks();mocks.gate=null;mocks.rows.clear();mocks.impersonated=false;mocks.restricted=false;mocks.user={id:'o',rol:'OPERADOR',actorId:'o',training:false};});
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
 expect(screen.getByText(/1 adenda por resolver antes del final/)).toBeVisible();
});

it('requires an explicit treatment decision and quantity for an approved finding in the final',async()=>{
 const finding={id:'hallazgo:Y12:kg',corriente:'Y12',unidad:'kg',observado:2,adendas:[{id:'adenda',version:2}]};
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0,hallazgos:[finding],problemasHallazgos:[]}});
 mocks.post.mockRejectedValue({response:{data:{message:'QA sin envío'}}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación final total'}));
 expect(screen.getByText(/Un hallazgo aprobado registra lo observado/)).toBeVisible();
 fireEvent.click(screen.getByText('Use QA signature'));
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Tratamiento de Y12 (kg)'),{target:{value:'si'}});
 fireEvent.change(screen.getByLabelText('Cantidad tratada Y12 (kg)'),{target:{value:'1'}});
 fireEvent.click(screen.getByText('Use QA signature'));
 fireEvent.click(screen.getByRole('button',{name:'Firmar y publicar certificación'}));
 await screen.findByText('QA sin envío');
 expect(mocks.post.mock.calls[0][1].cantidades).toContainEqual({residuoId:finding.id,cantidad:1});
 expect(mocks.post.mock.calls[0][1].exclusionesHallazgos).toBeUndefined();
});
it('records an explicit no-treatment decision without claiming the finding was treated',async()=>{
 const finding={id:'hallazgo:Y12:kg',corriente:'Y12',unidad:'kg',observado:2,adendas:[{id:'adenda',version:2}]};
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0,hallazgos:[finding]}});
 mocks.post.mockRejectedValue({response:{data:{message:'QA sin envío'}}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación final total'}));
 fireEvent.change(screen.getByLabelText('Tratamiento de Y12 (kg)'),{target:{value:'no'}});
 fireEvent.click(screen.getByText('Use QA signature'));
 fireEvent.click(screen.getByRole('button',{name:'Firmar y publicar certificación'}));
 await screen.findByText('QA sin envío');
 expect(mocks.post.mock.calls[0][1].exclusionesHallazgos).toEqual([finding.id]);
 expect(mocks.post.mock.calls[0][1].cantidades).not.toContainEqual(expect.objectContaining({residuoId:finding.id}));
 expect(screen.getByText('No tratadas: Y12')).toBeVisible();
});
it('blocks final certification when approved finding reports conflict',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0,hallazgos:[],problemasHallazgos:['Los informes discrepan.']}});
 show();
 expect(await screen.findByRole('button',{name:'Emitir certificación final total'})).toBeDisabled();
 expect(screen.getByRole('alert')).toHaveTextContent('Los informes discrepan');
});
it('does not silently omit a finding already included in an earlier signed partial',async()=>{
 mocks.get.mockResolvedValue({data:{data:[{id:'partial',createdAt:'2026-10-21T10:00:00Z',documento:{tipo:'PARCIAL',cantidades:[{residuoId:'hallazgo:Y12:kg',corriente:'Y12',unidad:'kg',cantidad:1}]}}],emisionHabilitada:true,adendasSinResolver:0,hallazgos:[]}});
 show();
 expect(await screen.findByRole('button',{name:'Emitir certificación final total'})).toBeDisabled();
 expect(screen.getByRole('alert')).toHaveTextContent('Un hallazgo ya certificado no coincide');
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

it.each(['parcial','final total'])('restores unsent %s on reopening and requires new signature',async type=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});
 const view=show();fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación '+type}));
 fireEvent.change(screen.getByLabelText('Observaciones del certificado (opcional)'),{target:{value:'Borrador sin enviar'}});
 fireEvent.click(screen.getByText('Use QA signature'));await screen.findByText('Borrador guardado en este dispositivo');view.unmount();
 show();await screen.findByText('Borrador recuperado en este dispositivo');
 expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toHaveValue('Borrador sin enviar');
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();expect(screen.getByText('Use QA signature')).toBeVisible();expect(mocks.post).not.toHaveBeenCalled();
});
it('changing a signed field requires new signature',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));fireEvent.click(screen.getByText('Use QA signature'));
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Método de tratamiento certificado'),{target:{value:'Otro método'}});
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();
 await screen.findByText('Borrador guardado en este dispositivo');
});
it('close preserves draft and discard requires explicit confirmation',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));
 fireEvent.change(screen.getByLabelText('Observaciones del certificado (opcional)'),{target:{value:'Conservar'}});
 fireEvent.click(screen.getByRole('button',{name:'Cerrar formulario'}));expect(screen.queryByLabelText('Observaciones del certificado (opcional)')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Continuar borrador'}));expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toHaveValue('Conservar');
 fireEvent.click(screen.getByRole('button',{name:'Descartar borrador'}));fireEvent.click(screen.getByRole('button',{name:'Conservar borrador'}));
 expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toHaveValue('Conservar');
 fireEvent.click(screen.getByRole('button',{name:'Descartar borrador'}));fireEvent.click(screen.getByRole('button',{name:'Sí, descartar borrador'}));
 await screen.findByRole('button',{name:'Emitir certificación parcial'});expect(mocks.post).not.toHaveBeenCalled();
});

it('requires explicit quantity refresh after pesage changes, retaining notes and clearing signature',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const tree=(manifest:any)=><MemoryRouter><QueryClientProvider client={q}><TrainingCertificates manifest={manifest}/></QueryClientProvider></MemoryRouter>;
 const view=render(tree(m));fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación final total'}));
 fireEvent.change(screen.getByLabelText('Observaciones del certificado (opcional)'),{target:{value:'Keep me'}});fireEvent.click(screen.getByText('Use QA signature'));
 view.rerender(tree({...m,residuos:[{...m.residuos[0],cantidadRecibida:12}]}));
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();
 expect(screen.getByLabelText('Cantidad a certificar Y1 (kg)')).toHaveValue(10);
 fireEvent.click(screen.getByRole('button',{name:'Actualizar cantidades del borrador'}));
 expect(screen.getByLabelText('Cantidad a certificar Y1 (kg)')).toHaveValue(12);
 expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toHaveValue('Keep me');
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();
 expect(screen.getByText('Use QA signature')).toBeVisible();expect(mocks.post).not.toHaveBeenCalled();await screen.findByText('Borrador guardado en este dispositivo');
});
it('blocks a saved preparation when a final has since been issued',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));fireEvent.click(screen.getByText('Use QA signature'));
 mocks.get.mockResolvedValue({data:{data:[{id:'final',numero:'M-F',createdAt:'2026-10-26T05:00:00Z',documento:{tipo:'FINAL',cantidades:[]}}],emisionHabilitada:true,adendasSinResolver:0}});
 fireEvent.click(screen.getByRole('button',{name:'Actualizar certificados'}));await screen.findByText(/Ya existe una certificación final total/);
 expect(screen.getByRole('button',{name:'Firmar y publicar certificación'})).toBeDisabled();expect(mocks.post).not.toHaveBeenCalled();
});

it('freezes signed fields while durable storage delays submission',async()=>{
 mocks.get.mockResolvedValue({data:{data:[],emisionHabilitada:true,adendasSinResolver:0}});
 mocks.post.mockRejectedValue({response:{data:{message:'Deliberate failure'}}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));await screen.findByText('Borrador guardado en este dispositivo');
 let done!:()=>void;mocks.gate=new Promise(resolve=>{done=resolve;});
 fireEvent.change(screen.getByLabelText('Observaciones del certificado (opcional)'),{target:{value:'Signed body'}});
 fireEvent.click(screen.getByText('Use QA signature'));fireEvent.click(screen.getByRole('button',{name:'Firmar y publicar certificación'}));
 expect(screen.getByLabelText('Observaciones del certificado (opcional)')).toBeDisabled();
 expect(screen.getByLabelText('Cantidad a certificar Y1 (kg)')).toBeDisabled();
 expect(mocks.post).not.toHaveBeenCalled();done();
 await screen.findByText('Deliberate failure');expect(mocks.post.mock.calls[0][1].nota).toBe('Signed body');
});
