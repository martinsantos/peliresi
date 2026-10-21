import { beforeEach, expect, it, vi } from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TrainingCertificates} from '../../pages/manifiestos/components/TrainingCertificates';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),user:{id:'o',rol:'OPERADOR',actorId:'o',training:false}}));
vi.mock('../../services/api',()=>({api:{get:mocks.get,post:mocks.post}}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:mocks.user})}));
vi.mock('../../components/ui/SignaturePad',()=>({SignaturePad:({onConfirm}:any)=><button type="button" onClick={()=>onConfirm('test-signature')}>Use QA signature</button>}));
beforeEach(()=>{vi.clearAllMocks();mocks.user={id:'o',rol:'OPERADOR',actorId:'o',training:false};});
const m:any={id:'m',numero:'M',estado:'TRATADO',operadorId:'o',tratamientoMetodo:'Tratamiento registrado',residuos:[{id:'r',cantidadRecibida:10,unidad:'kg',tipoResiduo:{codigo:'Y1'}}]};
function show(){const q=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<MemoryRouter><QueryClientProvider client={q}><TrainingCertificates manifest={m}/></QueryClientProvider></MemoryRouter>);}
it('prefills remaining partial quantities and method, retains form after a failed issue',async()=>{
 mocks.get.mockResolvedValue({data:{data:[{id:'c',createdAt:'2026-10-21T10:00:00Z',documento:{tipo:'PARCIAL',cantidades:[{residuoId:'r',cantidad:4,corriente:'Y1',unidad:'kg'}]}}],emisionHabilitada:true,adendasSinResolver:0}});
 mocks.post.mockRejectedValue({response:{data:{message:'Servicio no disponible'}}});show();
 fireEvent.click(await screen.findByRole('button',{name:'Emitir certificación parcial'}));
 expect(screen.getByLabelText('Cantidad a certificar Y1 (kg)')).toHaveValue(6);
 expect(screen.getByLabelText('Método de tratamiento certificado')).toHaveValue('Tratamiento registrado');
 fireEvent.click(screen.getByText('Use QA signature'));fireEvent.click(screen.getByText('Firmar y publicar certificación'));
 await screen.findByText('Servicio no disponible');expect(screen.getByLabelText('Cantidad a certificar Y1 (kg)')).toHaveValue(6);
 fireEvent.click(screen.getByText('Firmar y publicar certificación'));await waitFor(()=>expect(mocks.post).toHaveBeenCalledTimes(2));
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
