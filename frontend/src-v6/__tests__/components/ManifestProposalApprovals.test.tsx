import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor,act,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
const mock=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),role:'TRANSPORTISTA',actorId:'transport' as string|undefined}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'transport-user',rol:mock.role,actorId:mock.actorId,training:false}})}));
vi.mock('../../contexts/ImpersonationContext',()=>({useImpersonation:()=>({impersonationData:null})}));
import {ManifestProposalApprovals} from '../../pages/manifiestos/components/ManifestProposalApprovals';
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.clearAllMocks();mock.role='TRANSPORTISTA';mock.actorId='transport';});
it('refreshes the parent when another party starts coordination without changing APROBADO',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 const data={autorRol:'GENERADOR',estado:'APROBADO',inicio:null as string|null,puedeIniciar:true,puedeAprobar:null,partes:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({rol,aprobada:true}))};
 mock.get.mockImplementation(async()=>({data:{data:{...data}}}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),invalidate=vi.spyOn(client,'invalidateQueries');
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="proposal" estado="APROBADO" onSign={()=>{}}/></QueryClientProvider>);
 await screen.findByRole('button',{name:'Iniciar coordinación'});await waitFor(()=>expect(invalidate).toHaveBeenCalledWith({queryKey:['manifiestos','detail','proposal']}));invalidate.mockClear();
 data.inicio=new Date().toISOString();data.puedeIniciar=false;
 await act(async()=>{await client.invalidateQueries({queryKey:['manifest-proposal']});});
 await screen.findByText('Coordinación iniciada');expect(invalidate).toHaveBeenCalledWith({queryKey:['manifiestos','detail','proposal']});
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).toBeNull();client.clear();
});
it('does not query proposals or offer party decisions when the operational flag is closed',()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','false');
 const client=new QueryClient();render(<QueryClientProvider client={client}><ManifestProposalApprovals id="proposal" estado="APROBADO" onSign={()=>{}}/></QueryClientProvider>);
 expect(mock.get).not.toHaveBeenCalled();expect(screen.queryByRole('region')).toBeNull();client.clear();
});
it('does not present approval or a start action from status alone when a party is still pending',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'APROBADO',inicio:null,puedeIniciar:true,puedeAprobar:null,partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="inconsistent" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('2 de 3 aprobaciones')).toBeVisible();
 expect(screen.getByRole('alert')).toHaveTextContent('No constan todas las aprobaciones');
 expect(screen.queryByText('Todo aprobado')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('Transporte: Pendiente')).toHaveClass('text-neutral-600');
 client.clear();
});
it.each([null,undefined,{},[],[{rol:'GENERADOR',aprobada:true}],
 [{rol:'GENERADOR',aprobada:true},{rol:'GENERADOR',aprobada:true},{rol:'OPERADOR',aprobada:true}],
 [{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:'false'},{rol:'OPERADOR',aprobada:true}]].map(partes=>[partes]))
 ('keeps the detail usable and requests refresh when approval data is invalid: %j',async partes=>{
  vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
  mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:'TRANSPORTISTA',partes}}});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ManifestProposalApprovals id="invalid" onSign={()=>{}}/></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar las aprobaciones');
  expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Actualizar aprobaciones'}));
  await waitFor(()=>expect(mock.get.mock.calls.length).toBeGreaterThan(1));
  expect(mock.post).not.toHaveBeenCalled();client.clear();
 });
it('does not call a record approved or offer a decision when all three decisions conflict with pending status',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:null,
  partes:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({rol,aprobada:true}))}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="state-conflict" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('El estado no coincide con las decisiones registradas');
 expect(screen.queryByText('3 de 3 · Aprobado')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();client.clear();
});
it.each(['GENERADOR','OPERADOR'])('does not offer another role’s approval to the current transport user: %s',async otherRole=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:otherRole,
  partes:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({rol,aprobada:rol!==otherRole}))}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="wrong-role" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar qué acción corresponde a tu cuenta');
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Firmar Manifiesto'})).not.toBeInTheDocument();client.clear();
});
it.each([
 {puedeIniciar:'true'}, {puedeRechazar:'false'}, {requiereNuevaPropuesta:'false'}, {puedeAprobar:false},
 {inicio:undefined}, {inicio:'no-es-una-fecha'}, {rechazo:{motivo:'dato inválido'}},
])('does not offer actions from malformed coordination or permission data: %j',async overrides=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:'TRANSPORTISTA',
  partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}],...overrides}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="bad-flags" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar las aprobaciones');
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();client.clear();
});
it('does not offer another decision if coordination is recorded on a still-pending proposal',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:'2026-10-25T12:00:00Z',puedeIniciar:false,puedeAprobar:'TRANSPORTISTA',
  partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="premature-start" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('El estado no coincide con las decisiones registradas');
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();client.clear();
});
it('does not offer a second approval for a decision already recorded for the current user',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:'TRANSPORTISTA',
  partes:[{rol:'GENERADOR',aprobada:false},{rol:'TRANSPORTISTA',aprobada:true},{rol:'OPERADOR',aprobada:false}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="already-approved" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar qué acción corresponde a tu cuenta');
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();client.clear();
});
it('does not offer coordination to an administrator if a response incorrectly claims they can start it',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');mock.role='ADMIN';mock.actorId=undefined;
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'APROBADO',inicio:null,puedeIniciar:true,puedeAprobar:null,
  partes:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({rol,aprobada:true}))}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="admin-start" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar qué acción corresponde a tu cuenta');
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();client.clear();
});
it.each(['NO_IDENTIFICADO','constructor',null])('does not assign an unknown proposal creator to administration: %j',async autorRol=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol,estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:null,
  partes:[{rol:'GENERADOR',aprobada:false},{rol:'TRANSPORTISTA',aprobada:true},{rol:'OPERADOR',aprobada:false}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="unknown-author" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('Creado por No informado')).toBeVisible();
 expect(screen.queryByText('Creado por Administrador')).not.toBeInTheDocument();client.clear();
});
it('shows the busy response and lets the user refresh approvals without replaying the decision',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:'TRANSPORTISTA',partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}]}}});
 mock.post.mockRejectedValueOnce({response:{status:503,data:{message:'El sistema está ocupado. Esperá unos segundos y revisá el estado antes de volver a intentar.'}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="busy" onSign={()=>{}}/></QueryClientProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Aprobar como transporte'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('revisá el estado antes de volver a intentar');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Actualizar aprobaciones'})).toBeEnabled());
 const reads=mock.get.mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Actualizar aprobaciones'}));
 await waitFor(()=>expect(mock.get.mock.calls.length).toBeGreaterThan(reads));
 expect(mock.post).toHaveBeenCalledTimes(1);
 expect(screen.getByLabelText('Transporte: Pendiente')).toBeVisible();client.clear();
});
it('keeps a historical in-situ agreement without transport blocked',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{modalidad:'IN_SITU',autorRol:'GENERADOR',estado:'APROBADO',inicio:null,puedeIniciar:false,puedeAprobar:null,requiereNuevaPropuesta:true,partes:[{rol:'GENERADOR',aprobada:true},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><ManifestProposalApprovals id="in-situ" onSign={()=>{}}/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByText('Propuesta anterior')).toBeVisible();
 expect(screen.getByLabelText('Generador: Aprobado')).toBeVisible();
 expect(screen.getByLabelText('Operador: Aprobado')).toBeVisible();
 expect(screen.queryByLabelText(/^Transporte:/)).not.toBeInTheDocument();
 expect(screen.getByRole('alert')).toHaveTextContent('no tiene transporte aprobador');
 expect(screen.getByRole('link',{name:'Abrir nueva propuesta'})).toHaveAttribute('href','/manifiestos/nuevo');
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();
 client.clear();
});
it('requires the three approved parties before coordinating in-situ without a trip',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{modalidad:'IN_SITU',autorRol:'GENERADOR',estado:'APROBADO',inicio:null,puedeIniciar:true,puedeAprobar:null,partes:['GENERADOR','TRANSPORTISTA','OPERADOR'].map(rol=>({rol,aprobada:true}))}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="in-situ-three" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('3 de 3 · Aprobado')).toBeVisible();
 expect(screen.getByLabelText('Transporte: Aprobado')).toBeVisible();
 expect(screen.getByRole('button',{name:'Iniciar coordinación'})).toBeEnabled();
 fireEvent.click(screen.getByText('Cómo continuar'));
 expect(screen.getByText('Coordiná la recepción en origen con la otra parte. No hay viaje ni GPS.')).toBeVisible();
 client.clear();
});

it('preserves a readable rejected proposal when legacy rejection text is not JSON',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'CANCELADO',rechazo:'No tenemos capacidad',inicio:null,puedeIniciar:false,puedeAprobar:null,partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="legacy-rejected" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText(/Propuesta rechazada: No tenemos capacidad/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Iniciar coordinación'})).not.toBeInTheDocument();client.clear();
});

it('shows a recorded rejection with no available reason without offering a new decision',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',rechazo:'Rechazo registrado sin motivo disponible',inicio:null,puedeIniciar:false,puedeAprobar:null,puedeRechazar:false,
  partes:[{rol:'GENERADOR',aprobada:false},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:false}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="previous-rejection" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('Propuesta detenida')).toBeVisible();
 expect(screen.getByText(/Rechazo registrado sin motivo disponible/)).toBeVisible();
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();client.clear();
});
it.each([null,'','   '])('does not offer an action when an older response includes a rejection without a readable reason: %j',async rechazo=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',rechazo,inicio:null,puedeIniciar:false,puedeAprobar:'TRANSPORTISTA',puedeRechazar:false,
  partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:true}]}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><ManifestProposalApprovals id="old-empty-rejection" onSign={()=>{}}/></QueryClientProvider>);
 expect(await screen.findByText('Propuesta detenida')).toBeVisible();
 expect(screen.getByText(/Rechazo registrado sin motivo disponible/)).toBeVisible();
 expect(screen.queryByRole('button',{name:/Aprobar como/})).not.toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();client.clear();
});

it('lets an already approved party reject a still pending proposal with a reason',async()=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 mock.get.mockResolvedValue({data:{data:{autorRol:'GENERADOR',estado:'PENDIENTE_APROBACION',inicio:null,puedeIniciar:false,puedeAprobar:null,puedeRechazar:true,
  partes:[{rol:'GENERADOR',aprobada:true},{rol:'TRANSPORTISTA',aprobada:true},{rol:'OPERADOR',aprobada:false}]}}});
 mock.post.mockResolvedValue({data:{success:true}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><ManifestProposalApprovals id="proposal" onSign={()=>{}}/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByText(/Ambas decisiones quedan en el historial/)).toBeVisible();
 fireEvent.click(screen.getByText('No puedo participar / rechazar'));
 fireEvent.change(screen.getByLabelText('Motivo del rechazo'),{target:{value:'No puedo participar'}});
 fireEvent.click(screen.getByRole('button',{name:'Rechazar mi participación'}));
 await waitFor(()=>expect(mock.post).toHaveBeenCalledWith('/manifiestos/proposal/aprobar-parte',{decision:'RECHAZADA',motivo:'No puedo participar'}));
 client.clear();
});
