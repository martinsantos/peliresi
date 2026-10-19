import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({tx:{} as any,manifest:{} as any,events:[] as any[]}));
vi.mock('../lib/prisma',()=>({default:new Proxy({}, {get:(_,key)=>key==='$transaction'?async(fn:any)=>typeof fn==='function'?fn(mock.tx):Promise.all(fn):mock.tx[key]})}));
vi.mock('qrcode',()=>({default:{toDataURL:vi.fn().mockResolvedValue('data:qr')}}));
import {inTrainingSession,inOperationalSession} from '../lib/trainingScope';
import {canCreateManifestProposal,MANIFEST_PROPOSAL,proposalRole,parseProposal} from '../domain/manifestProposal';
import {approveManifestProposal,assertManifestProposalApproved,startManifestCoordination} from '../controllers/manifest-proposal.controller';
const p={version:1 as const,generadorId:'g',transportistaId:'t',operadorId:'o',creadoPorId:'uo',autorRol:'OPERADOR'};
const users={GENERADOR:{id:'ug',rol:'GENERADOR',generador:{id:'g'}},TRANSPORTISTA:{id:'ut',rol:'TRANSPORTISTA',transportista:{id:'t'}},OPERADOR:{id:'uo',rol:'OPERADOR',operador:{id:'o'}},ADMIN:{id:'ua',rol:'ADMIN'}};
const req=(rol:keyof typeof users,body={})=>({params:{id:'m'},user:users[rol],body} as any);
const signature={imagen:'signed-image',sha256:'signed-hash'};
beforeEach(()=>{
 mock.manifest={id:'m',numero:'CAP-TEST',estado:'PENDIENTE_APROBACION',...p,fechaEstimadaRetiro:new Date('2026-10-19T15:00:00Z')};
 mock.events=[{id:'marker',tipo:MANIFEST_PROPOSAL,descripcion:JSON.stringify(p)}];
 mock.tx={$queryRaw:vi.fn(),manifiesto:{findUnique:vi.fn(async()=>mock.manifest),findUniqueOrThrow:vi.fn(async()=>mock.manifest),update:vi.fn(async({data}:any)=>Object.assign(mock.manifest,data))},eventoManifiesto:{
 findFirst:vi.fn(async()=>mock.events.find(e=>e.tipo===MANIFEST_PROPOSAL)),findMany:vi.fn(async()=>mock.events.filter(e=>e.tipo!==MANIFEST_PROPOSAL)),create:vi.fn(async({data}:any)=>{const e={...data,id:String(mock.events.length),createdAt:new Date()};mock.events.push(e);return e;})},
 generador:{findUnique:vi.fn(async()=>({usuario:{id:'ug',activo:true}}))},transportista:{findUnique:vi.fn(async()=>({usuario:{id:'ut',activo:true}}))},operador:{findUnique:vi.fn(async()=>({usuario:{id:'uo',activo:true}}))},notificacion:{createMany:vi.fn()}};
});
describe('three independently authenticated parties',()=>{
 it.each(Object.keys(users) as (keyof typeof users)[])('allows %s creation only in the signed school scope',rol=>{
  expect(inOperationalSession(()=>canCreateManifestProposal(users[rol]))).toBe(false);
  expect(inTrainingSession(()=>canCreateManifestProposal(users[rol]))).toBe(true);
 });
 it('denies missing actor and restricted identities',()=>{
  expect(inTrainingSession(()=>canCreateManifestProposal({id:'x',rol:'OPERADOR'}))).toBe(false);
  expect(inTrainingSession(()=>canCreateManifestProposal({...users.OPERADOR,restricted:true}))).toBe(false);
 });
 it('does not let admin or another company approve a place',async()=>{
  expect(proposalRole({...users.OPERADOR,operador:{id:'other'}},p)).toBeNull();
  await expect(inTrainingSession(()=>approveManifestProposal(req('ADMIN')))).rejects.toMatchObject({statusCode:403});
  expect(mock.tx.eventoManifiesto.create).not.toHaveBeenCalled();
 });
 it('cannot reach a database for an operational approval',async()=>{
  await expect(inOperationalSession(()=>approveManifestProposal(req('OPERADOR')))).rejects.toMatchObject({statusCode:404});
  expect(mock.tx.manifiesto.findUnique).not.toHaveBeenCalled();
 });
 it('requires generator signature even if operator and transport have accepted',async()=>{
  await inTrainingSession(()=>approveManifestProposal(req('OPERADOR')));
  await inTrainingSession(()=>approveManifestProposal(req('TRANSPORTISTA')));
  await expect(inTrainingSession(()=>approveManifestProposal(req('GENERADOR')))).rejects.toMatchObject({statusCode:400});
  expect(mock.manifest.estado).toBe('PENDIENTE_APROBACION');
 });
 it('keeps pickup locked until all three approve, records each actor and signature, then notifies once',async()=>{
  await inTrainingSession(()=>approveManifestProposal(req('OPERADOR')));
  await inTrainingSession(()=>approveManifestProposal(req('GENERADOR'),signature));
  await expect(inTrainingSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
  expect(mock.manifest.estado).toBe('PENDIENTE_APROBACION');
  await inTrainingSession(()=>approveManifestProposal(req('TRANSPORTISTA')));
  await expect(inTrainingSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
  expect(mock.manifest.estado).toBe('APROBADO');
  expect(mock.events.filter(e=>e.tipo!==MANIFEST_PROPOSAL).map(e=>e.usuarioId)).toEqual(['uo','ug','ut']);
  expect(mock.events.find(e=>e.tipo==='FIRMA')).toMatchObject({firmaImagen:'signed-image',firmaSha256:'signed-hash'});
  await inTrainingSession(()=>approveManifestProposal(req('TRANSPORTISTA')));
  expect(mock.tx.eventoManifiesto.create).toHaveBeenCalledTimes(3);expect(mock.tx.notificacion.createMany).toHaveBeenCalledTimes(3);
 });
 it('preserves a reasoned rejection and refuses subsequent approvals and pickup',async()=>{
  await inTrainingSession(()=>approveManifestProposal(req('GENERADOR',{decision:'RECHAZADA',motivo:'Fecha incorrecta'})));
  expect(mock.manifest.estado).toBe('RECHAZADO');
  expect(JSON.parse(mock.events.at(-1).descripcion)).toMatchObject({rol:'GENERADOR',motivo:'Fecha incorrecta',decision:'RECHAZADA'});
  await expect(inTrainingSession(()=>approveManifestProposal(req('OPERADOR')))).rejects.toMatchObject({statusCode:409});
  await expect(inTrainingSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 });
 it('rejects corrupted or changed participant snapshots',async()=>{
  expect(()=>parseProposal('{}')).toThrow();expect(()=>parseProposal('null')).toThrow();mock.manifest.operadorId='other';
  await expect(inTrainingSession(()=>approveManifestProposal(req('OPERADOR')))).rejects.toMatchObject({statusCode:404});
  await expect(inTrainingSession(()=>approveManifestProposal(req('GENERADOR'),signature))).rejects.toMatchObject({statusCode:409});
 });
 it('refuses pickup if a rejected history is manually changed to approved',async()=>{
  for(const rol of ['OPERADOR','TRANSPORTISTA','GENERADOR'] as const) await inTrainingSession(()=>approveManifestProposal(req(rol),rol==='GENERADOR'?signature:undefined));
  mock.events.push({tipo:'RECHAZO_PARTE'});
  await expect(inTrainingSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 });
 it('does not attach new approval requirements to old records',async()=>{
  mock.events=[];await expect(inTrainingSession(()=>assertManifestProposalApproved(mock.tx,'m'))).resolves.toBeUndefined();
 });
});

describe('explicit coordination start',()=>{
 it('requires unanimity, preserves pickup state, and is idempotent across retries',async()=>{
  const next=vi.fn(),json=vi.fn(),res={json} as any;
  await inTrainingSession(()=>startManifestCoordination(req('OPERADOR'),res,next));expect(next).toHaveBeenLastCalledWith(expect.objectContaining({statusCode:409}));
  for(const rol of ['OPERADOR','TRANSPORTISTA','GENERADOR'] as const)await inTrainingSession(()=>approveManifestProposal(req(rol),rol==='GENERADOR'?signature:undefined));
  next.mockClear();await inTrainingSession(()=>startManifestCoordination(req('ADMIN'),res,next));expect(next).toHaveBeenLastCalledWith(expect.objectContaining({statusCode:403}));
  for(const rol of ['OPERADOR','GENERADOR','TRANSPORTISTA'] as const){next.mockClear();await inTrainingSession(()=>startManifestCoordination(req(rol),res,next));expect(next).not.toHaveBeenCalled();}
  expect(mock.events.filter(e=>e.tipo==='INICIO_COORDINACION_CAP')).toHaveLength(1);expect(mock.manifest.estado).toBe('APROBADO');expect(mock.manifest.fechaRetiro).toBeUndefined();
  await expect(inTrainingSession(()=>assertManifestProposalApproved(mock.tx,'m'))).resolves.toBeUndefined();
 });
 it('cannot start an operational or rejected proposal',async()=>{
  const next=vi.fn();await inOperationalSession(()=>startManifestCoordination(req('OPERADOR'),{} as any,next));expect(next).toHaveBeenLastCalledWith(expect.objectContaining({statusCode:404}));
  await inTrainingSession(()=>approveManifestProposal(req('GENERADOR',{decision:'RECHAZADA',motivo:'No acepto'})));
  await inTrainingSession(()=>startManifestCoordination(req('OPERADOR'),{} as any,next));expect(next).toHaveBeenLastCalledWith(expect.objectContaining({statusCode:409}));
 });
});

describe('training agenda metadata',()=>{
 it('returns independent approvals without inventing decisions and keeps actor filtering',async()=>{
  const {getTrainingTasks}=await import('../controllers/manifest-proposal.controller');
  mock.tx.manifiesto.findMany=vi.fn(async()=>[{...mock.manifest,eventos:mock.events,residuos:[]}]);
  const json=vi.fn(),next=vi.fn();await inTrainingSession(()=>getTrainingTasks(req('OPERADOR'),{json} as any,next));
  expect(next).not.toHaveBeenCalled();const result=json.mock.calls[0][0].data.items[0];
  expect(result.requiereMiAprobacion).toBe(true);expect(result.inicio).toBeNull();expect(result.partes).toHaveLength(3);expect(result.partes.every((p:any)=>p.aprobada===false)).toBe(true);
  expect(mock.tx.manifiesto.findMany.mock.calls[0][0].where.operadorId).toBe('o');
 });
 it('includes ongoing reception and treatment for the CAP administrator, never in the operational scope',async()=>{
  const {getTrainingTasks}=await import('../controllers/manifest-proposal.controller');
  mock.tx.manifiesto.findMany=vi.fn(async()=>['ENTREGADO','RECIBIDO','EN_TRATAMIENTO'].map(estado=>({...mock.manifest,estado,eventos:mock.events,residuos:[{cantidadRecibida:null}]})));
  const json=vi.fn(),next=vi.fn();await inTrainingSession(()=>getTrainingTasks(req('ADMIN'),{json} as any,next));expect(json.mock.calls[0][0].data.items).toHaveLength(3);
  mock.tx.manifiesto.findMany.mockClear();await inOperationalSession(()=>getTrainingTasks(req('ADMIN'),{json} as any,next));expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:404}));expect(mock.tx.manifiesto.findMany).not.toHaveBeenCalled();
 });
});

describe('bounded searchable scheduled agenda',()=>{
 it('returns later pages with the same actor filter and a bound of 50',async()=>{
  const {getProposalAgenda}=await import('../controllers/manifest-proposal.controller');
  mock.tx.manifiesto.findMany=vi.fn(async()=>[]);mock.tx.manifiesto.count=vi.fn(async()=>73);
  const json=vi.fn(),next=vi.fn();await inTrainingSession(()=>getProposalAgenda({...req('OPERADOR'),query:{page:'2',search:' CAP-2026-000084 '}} as any,{json} as any,next));
  expect(next).not.toHaveBeenCalled();expect(mock.tx.manifiesto.findMany).toHaveBeenCalledWith(expect.objectContaining({take:50,skip:50,where:expect.objectContaining({operadorId:'o',estado:'APROBADO',numero:{contains:'CAP-2026-000084',mode:'insensitive'}})}));
  expect(json).toHaveBeenCalledWith({success:true,data:{items:[],total:73,page:2,pageSize:50}});
 });
 it.each(['0','-1','1.5','100001'])('rejects invalid page %s before querying',async page=>{
  const {getProposalAgenda}=await import('../controllers/manifest-proposal.controller');const next=vi.fn();mock.tx.manifiesto.findMany=vi.fn();
  await inTrainingSession(()=>getProposalAgenda({...req('OPERADOR'),query:{page}} as any,{json:vi.fn()} as any,next));expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(mock.tx.manifiesto.findMany).not.toHaveBeenCalled();
 });
 it('does not enable scheduled agenda for operational sessions',async()=>{
  const {getProposalAgenda}=await import('../controllers/manifest-proposal.controller');const next=vi.fn();mock.tx.manifiesto.findMany=vi.fn();
  await inOperationalSession(()=>getProposalAgenda({...req('ADMIN'),query:{}} as any,{json:vi.fn()} as any,next));expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:404}));expect(mock.tx.manifiesto.findMany).not.toHaveBeenCalled();
 });
});
