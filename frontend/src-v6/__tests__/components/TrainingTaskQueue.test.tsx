import {fireEvent,render,screen,cleanup,within,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Route,Routes,useNavigate} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({get:vi.fn(),training:true,id:'u',rol:'OPERADOR',actorId:'o',empresaId:'e',establecimientoId:'s',create:vi.fn()}));
vi.mock('../../services/api',()=>({api:mock}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:mock.id,training:mock.training,rol:mock.rol,actorId:mock.actorId,empresaContexto:{empresaId:mock.empresaId,establecimientoId:mock.establecimientoId}}})}));
vi.mock('../../services/manifiesto.service',()=>({manifiestoService:{create:mock.create}}));
import {useCreateManifiesto} from '../../hooks/useManifiestoWorkflow';
import {TrainingTaskQueue} from '../../components/TrainingTaskQueue';
afterEach(()=>{vi.unstubAllEnvs();cleanup();sessionStorage.clear();Object.assign(mock,{training:true,id:'u',rol:'OPERADOR',actorId:'o',empresaId:'e',establecimientoId:'s'});vi.clearAllMocks();vi.useRealTimers();});
const partes=[{rol:'GENERADOR',aprobada:false},{rol:'TRANSPORTISTA',aprobada:true},{rol:'OPERADOR',aprobada:true}];
const items=[{id:'a',numero:'CAP-NEW',estado:'PENDIENTE_APROBACION',requiereMiAprobacion:true,partes,fechaEstimadaRetiro:'2099-10-20T12:00:00Z'},{id:'b',numero:'CAP-TRIP',estado:'EN_TRANSITO',partes:partes.map(p=>({...p,aprobada:true})),fechaEstimadaRetiro:'2020-10-20T12:00:00Z'}];
function reply(records:any[], options:any={params:{}}){
 const {filter='all',period='all',search='',page=1,limit=6}=options.params||{};
 const day=(value:any)=>new Date(value).toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Mendoza'}),today=day(new Date());
 const base=records.filter(m=>(!search||m.numero.toLowerCase().includes(search.toLowerCase()))&&(period==='all'||period==='today'&&day(m.fechaEstimadaRetiro)===today||period==='future'&&day(m.fechaEstimadaRetiro)>today));
 const groups:any={all:base,mine:base.filter(m=>m.requiereMiAprobacion),waiting:base.filter(m=>m.estado==='PENDIENTE_APROBACION'&&(mock.rol==='ADMIN'||!m.requiereMiAprobacion)),progress:base.filter(m=>m.estado==='EN_TRANSITO'),certificates:base.filter(m=>m.certificatePending),drafts:base.filter(m=>m.estado==='BORRADOR')};
 const matches=groups[filter];return {data:{data:{items:matches.slice((page-1)*limit,page*limit),total:matches.length,page,limit,counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,(v as any[]).length]))}}};
}
function mount(){mock.get.mockImplementation(async(_url,options)=>reply(items,options));render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);}
it('filters current work, preserves approval states and links to the exact manifest',async()=>{
 mount();await screen.findByText('CAP-NEW');
 const row=screen.getByRole('link',{name:/CAP-NEW/});expect(row).toHaveAttribute('href','/manifiestos/a');expect(within(row).getByLabelText('Generador: Pendiente')).toBeVisible();expect(within(row).getByLabelText('Transporte: Aprobado')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Por aprobar'}));await screen.findByText('CAP-NEW');expect(screen.queryByText('CAP-TRIP')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'En curso'}));await screen.findByText('CAP-TRIP');expect(screen.queryByText('CAP-NEW')).not.toBeInTheDocument();expect(screen.getByText('CAP-TRIP')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Todos'}));fireEvent.click(screen.getByRole('button',{name:'Filtrar',exact:true}));fireEvent.change(screen.getByLabelText('Fecha de la agenda'),{target:{value:'future'}});expect(screen.queryByText('CAP-TRIP')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Buscar manifiesto en agenda'),{target:{value:'missing'}});expect(await screen.findByText('Sin manifiestos para estos filtros.')).toBeVisible();
});
it('is not enabled in operational sessions',()=>{mock.training=false;mount();expect(mock.get).not.toHaveBeenCalled();expect(screen.queryByLabelText('Agenda de manifiestos')).not.toBeInTheDocument();});
it('shows an operations agenda for the CAP administrator',async()=>{mock.rol='ADMIN';mount();expect(await screen.findByText('Manifiestos pendientes')).toBeVisible();expect(await screen.findByText('CAP-TRIP')).toBeVisible();});

it('keeps Hoy and Próximos on the Mendoza date when UTC is already the following day',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T01:30:00Z'));
 const records=[
  {...items[1],id:'today',numero:'CAP-HOY',fechaEstimadaRetiro:'2026-10-19T15:00:00Z'},
  {...items[1],id:'utc-next',numero:'CAP-TARDE',fechaEstimadaRetiro:'2026-10-20T01:00:00Z'},
  {...items[1],id:'future',numero:'CAP-MANANA',fechaEstimadaRetiro:'2026-10-20T15:00:00Z'},
 ];
 mock.get.mockImplementation(async(_url,options)=>reply(records,options));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 await screen.findByText('CAP-HOY');fireEvent.click(screen.getByRole('button',{name:'Filtrar',exact:true}));fireEvent.change(screen.getByLabelText('Fecha de la agenda'),{target:{value:'today'}});await screen.findByText('CAP-HOY');
 expect(screen.getByText('CAP-HOY')).toBeVisible();expect(screen.getByText('CAP-TARDE')).toBeVisible();expect(screen.queryByText('CAP-MANANA')).toBeNull();
 fireEvent.change(screen.getByLabelText('Fecha de la agenda'),{target:{value:'future'}});await screen.findByText('CAP-MANANA');expect(screen.getByText('CAP-MANANA')).toBeVisible();expect(screen.queryByText('CAP-HOY')).toBeNull();expect(screen.queryByText('CAP-TARDE')).toBeNull();client.clear();
});

it('shows an update error instead of a false empty agenda and recovers on retry',async()=>{
 mock.get.mockRejectedValueOnce(new Error('Synthetic connection failure'));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos actualizar la agenda');expect(screen.queryByText('Sin manifiestos para estos filtros.')).toBeNull();
 mock.get.mockResolvedValue({data:{data:{items,total:2,limited:false}}});fireEvent.click(screen.getByRole('button',{name:'Reintentar',exact:true}));await screen.findByText('CAP-NEW');expect(screen.queryByRole('alert')).toBeNull();client.clear();
});

function Creation(){const mutation=useCreateManifiesto();return <button onClick={()=>mutation.mutate({} as any)}>Crear propuesta de prueba</button>;}
it.each(['OPERADOR','GENERADOR','TRANSPORTISTA','ADMIN'])('shows a newly created waiting proposal first without waiting for polling: %s',async(role)=>{
 mock.rol=role;
 let records=Array.from({length:8},(_,i)=>({...items[1],id:'old-'+i,numero:'CAP-OLD-'+i,fechaEstimadaRetiro:new Date().toISOString()}));
 mock.get.mockImplementation(async(_url,options)=>reply(records,options));
 mock.create.mockImplementation(async()=>{records=[{...items[0],id:'latest',numero:'CAP-LATEST',requiereMiAprobacion:false,fechaEstimadaRetiro:'2099-12-25T12:00:00Z'},...records];return {id:'latest'};});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><Creation/><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 await screen.findByText('CAP-OLD-0');expect(screen.queryByText('CAP-OLD-7')).not.toBeInTheDocument();
 const oldRow=screen.getByRole('link',{name:/CAP-OLD-0/});
 fireEvent.click(screen.getByRole('button',{name:'Crear propuesta de prueba'}));
 await waitFor(()=>expect(screen.getAllByRole('link')[0]).toHaveTextContent('CAP-LATEST'),{timeout:1000});
 expect(within(screen.getAllByRole('link')[0]).getByText('En espera')).toBeVisible();
 expect(screen.getByRole('link',{name:/CAP-OLD-0/})).toBe(oldRow);
 fireEvent.click(screen.getByRole('button',{name:role==='ADMIN'?'Por aprobar':'En espera',exact:true}));await screen.findByText('CAP-LATEST');expect(screen.getByRole('link',{name:/CAP-LATEST/})).toBeVisible();expect(screen.queryByText('CAP-OLD-0')).not.toBeInTheDocument();
 client.clear();
});

it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('offers the live operational agenda only when its flag is enabled: %s',async role=>{
 mock.training=false;mock.rol=role;vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');mount();
 await screen.findByText('CAP-NEW');expect(screen.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();
 expect(mock.get).toHaveBeenCalledWith('/manifiestos/tareas-partes',expect.objectContaining({params:expect.objectContaining({page:1,limit:6})}));
});

it('uses server totals and opens certificates after treatment without asking another party to issue',async()=>{
 mock.rol='GENERADOR';mock.get.mockResolvedValue({data:{data:{items:[{...items[1],id:'closed',numero:'QA-FINAL',estado:'TRATADO',certificatePending:true}],total:121,page:1,limit:6,counts:{all:121,certificates:12}}}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByText('Esperando certificado final')).toBeVisible();expect(screen.getByRole('link',{name:/QA-FINAL/})).toHaveAttribute('href','/manifiestos/closed#certificaciones');
 expect(screen.getByText('121 pendientes · Página 1 de 21')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
 await waitFor(()=>expect(mock.get).toHaveBeenLastCalledWith('/manifiestos/tareas-partes',expect.objectContaining({params:expect.objectContaining({page:2})})));client.clear();
});

it('shows administrator approval tasks with actor names and the missing parties',async()=>{
 mock.training=false;mock.rol='ADMIN';vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
 const record={...items[0],requiereMiAprobacion:false,actores:{generador:'Origen artificial',transportista:'Transporte artificial',operador:'Destino artificial'}};
 mock.get.mockImplementation(async(_url,options)=>reply([record],options));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 const pending=await screen.findByRole('button',{name:'Por aprobar',exact:true});
 await waitFor(()=>expect(pending).toHaveAttribute('title','1 manifiesto · Por aprobar'));
 fireEvent.click(pending);
 await waitFor(()=>expect(mock.get).toHaveBeenLastCalledWith('/manifiestos/tareas-partes',expect.objectContaining({params:expect.objectContaining({filter:'waiting'})})));
 const row=await screen.findByRole('link',{name:/CAP-NEW/});
 expect(row).toHaveTextContent('Origen artificial → Destino artificial');
 expect(within(row).getByLabelText('Generador: Pendiente')).toBeVisible();
 expect(row).not.toHaveTextContent('Falta aprobar:');
 expect(row).toHaveAttribute('title',expect.stringContaining('Falta aprobar: Generador'));
 expect(screen.queryByRole('button',{name:'En espera'})).not.toBeInTheDocument();
 client.clear();
});

it.each(['GENERADOR','TRANSPORTISTA','OPERADOR','ADMIN'])('does not claim treatment is next when weighing cannot be verified for %s',async role=>{
 mock.rol=role;mock.get.mockImplementation(async(_url,options)=>reply([{...items[1],id:'no-waste',numero:'QA-SIN-PESAJE',estado:'RECIBIDO',pesajePendiente:false,pesajeNoDisponible:true,detail:'No se encontraron residuos para comprobar el pesaje.'}],options));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 const row=await screen.findByRole('link',{name:/QA-SIN-PESAJE/});
 expect(row).toHaveTextContent('Pesaje por comprobar');
 expect(row).not.toHaveTextContent('Registrar tratamiento');
 client.clear();
});

it('does not advertise a start in the agenda when an approval is missing despite the stored status',async()=>{
 mock.get.mockImplementation(async(_url,options)=>reply([{...items[0],estado:'APROBADO',requiereMiAprobacion:false}],options));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 expect(await screen.findByText('Revisar aprobaciones')).toBeVisible();
 expect(screen.queryByText('Listo para iniciar')).not.toBeInTheDocument();
 expect(screen.getByLabelText('Generador: Pendiente')).toBeVisible();
 client.clear();
});

it('includes a draft with its next responsible party without inventing three approvals',async()=>{
 mock.get.mockImplementation(async(_url,options)=>reply([{id:'draft',numero:'QA-DRAFT',estado:'BORRADOR',modalidad:'IN_SITU',partes:null,requiereNuevaPropuesta:true,actores:{generador:'Origen artificial',transportista:null,operador:'Destino artificial'}}],options));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 await screen.findByText('QA-DRAFT');
 fireEvent.click(screen.getByRole('button',{name:'Borradores'}));
 const row=await screen.findByRole('link',{name:/QA-DRAFT/});
 expect(row).toHaveTextContent('Necesita nueva propuesta');
 expect(row).toHaveTextContent('Tratamiento en origen · sin traslado');
 expect(within(row).queryByLabelText('Transporte: Aprobado')).not.toBeInTheDocument();
 client.clear();
});

it('keeps other work visible while an inconsistent proposal requires review',async()=>{
 mock.get.mockImplementation(async(_url,options)=>reply([
  {id:'broken',numero:'QA-BROKEN',estado:'PENDIENTE_APROBACION',partes:null,requiereRevisionPropuesta:true,requiereMiAprobacion:false,detail:'Contactá a Ambiente',actores:{generador:'Origen',operador:'Destino'}},
  {id:'moving',numero:'QA-MOVING',estado:'EN_TRANSITO',partes:null,advertenciaPropuesta:true,actores:{generador:'Origen',operador:'Destino'}},
  ...items,
 ],options));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 const broken=await screen.findByRole('link',{name:/QA-BROKEN/});
 expect(broken).toHaveTextContent('Propuesta por revisar');
 expect(broken).toHaveAccessibleName(/Contactá a Ambiente/);
 expect(within(broken).queryByLabelText(/Aprobado/)).not.toBeInTheDocument();
 const moving=screen.getByRole('link',{name:/QA-MOVING/});
 expect(moving).toHaveTextContent('En viaje');
 expect(moving).toHaveTextContent('Aprobaciones históricas por revisar');
 expect(screen.getByText('CAP-NEW')).toBeVisible();
 client.clear();
});

function ReturnHome(){const navigate=useNavigate();return <button onClick={()=>navigate(-1)}>Volver</button>;}
it.each(['id','rol','actorId','empresaId','establecimientoId'] as const)('discards filters before the first request after changing %s',async field=>{
 mock.get.mockImplementation(async(_url,options)=>reply(items,options));
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const tree=()=> <MemoryRouter initialEntries={['/dashboard?pendientes=progress&buscarPendiente=CAP-TRIP&paginaPendientes=2']}><QueryClientProvider client={q}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>;
 const view=render(tree());await waitFor(()=>expect(mock.get).toHaveBeenCalled());
 mock.get.mockClear();mock[field]=field==='rol'?'GENERADOR':'different-context';view.rerender(tree());
 await screen.findByText('CAP-NEW');
 expect(mock.get.mock.calls[0][1].params).toMatchObject({filter:'all',search:'',page:1});
 expect(screen.getByRole('button',{name:'Todos'})).toHaveAttribute('aria-pressed','true');q.clear();
});

it('discards another account’s unowned login return URL, but preserves a same-account reopen',async()=>{
 mock.get.mockImplementation(async(_url,options)=>reply(items,options));
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const mountUrl=()=>render(<MemoryRouter initialEntries={['/dashboard?pendientes=progress&buscarPendiente=CAP-TRIP']}><QueryClientProvider client={q}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
 let view=mountUrl();await screen.findByText('CAP-TRIP');view.unmount();
 view=mountUrl();await screen.findByText('CAP-TRIP');expect(screen.queryByText('CAP-NEW')).toBeNull();view.unmount();
 mock.id='another-account';mock.get.mockClear();view=mountUrl();await screen.findByText('CAP-NEW');
 expect(mock.get.mock.calls[0][1].params).toMatchObject({filter:'all',search:'',page:1});q.clear();
});

it('restores filters after opening a record and returning on the same surface',async()=>{
 mock.get.mockImplementation(async(_url,options)=>reply(items,options));
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter basename="/app" initialEntries={['/app/dashboard?pendientes=progress&periodo=all']}><QueryClientProvider client={q}><Routes>
   <Route path="/dashboard" element={<TrainingTaskQueue/>}/>
   <Route path="/manifiestos/:id" element={<ReturnHome/>}/>
 </Routes></QueryClientProvider></MemoryRouter>);
 const row=await screen.findByRole('link',{name:/CAP-TRIP/});
 expect(screen.queryByText('CAP-NEW')).not.toBeInTheDocument();
 fireEvent.click(row);await screen.findByText('Volver');fireEvent.click(screen.getByText('Volver'));
 expect(await screen.findByRole('button',{name:'En curso'})).toHaveAttribute('aria-pressed','true');
 expect(await screen.findByText('CAP-TRIP')).toBeVisible();expect(screen.queryByText('CAP-NEW')).not.toBeInTheDocument();q.clear();
});


it('does not show an invalidated approval status while its replacement is pending', async () => {
  const q=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const key=['training-tasks','u','OPERADOR','o','e','s','all','all','',1];
  const stale={...items[0],numero:'QA-PROPOSAL',requiereMiAprobacion:true};
  q.setQueryData(key, reply([stale]).data.data);
  await q.invalidateQueries({queryKey:['training-tasks']});
  let finish!: (value: unknown) => void;
  mock.get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  render(<MemoryRouter><QueryClientProvider client={q}><TrainingTaskQueue/></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByRole('status')).toHaveTextContent('Actualizando agenda');
  expect(screen.queryByRole('link',{name:/QA-PROPOSAL/})).not.toBeInTheDocument();
  finish(reply([{...stale,estado:'APROBADO',requiereMiAprobacion:false,partes:partes.map(p=>({...p,aprobada:true}))}]));
  const row=await screen.findByRole('link',{name:/QA-PROPOSAL/});
  expect(row).toHaveTextContent('Listo para iniciar');
  expect(row).not.toHaveTextContent('Te toca aprobar');
  q.clear();
});
