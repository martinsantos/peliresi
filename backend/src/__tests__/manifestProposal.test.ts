import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({tx:{} as any,manifest:{} as any,events:[] as any[]}));
vi.mock('../lib/prisma',()=>({default:new Proxy({}, {get:(_,key)=>key==='$transaction'?async(fn:any)=>typeof fn==='function'?fn(mock.tx):Promise.all(fn):mock.tx[key]})}));
vi.mock('qrcode',()=>({default:{toDataURL:vi.fn().mockResolvedValue('data:qr')}}));
vi.mock('../services/domainEvent.service',()=>({domainEvents:{emit:vi.fn()}}));
vi.mock('../services/blockchain.service', async importOriginal => ({...await importOriginal<typeof import('../services/blockchain.service')>(),registrarSello:vi.fn().mockResolvedValue(null)}));
import QRCode from 'qrcode';
import {notifyManifestParties} from '../services/manifestProposal.service';
import {inTrainingSession,inOperationalSession} from '../lib/trainingScope';
import {canCreateManifestProposal,MANIFEST_PROPOSAL,proposalRole,proposalRoles,parseProposal} from '../domain/manifestProposal';
import {approveManifestProposal,assertManifestProposalApproved,startManifestCoordination} from '../controllers/manifest-proposal.controller';
const p={version:1 as const,generadorId:'g',transportistaId:'t',operadorId:'o',creadoPorId:'uo',autorRol:'OPERADOR'};
const users={GENERADOR:{id:'ug',rol:'GENERADOR',generador:{id:'g'}},TRANSPORTISTA:{id:'ut',rol:'TRANSPORTISTA',transportista:{id:'t'}},OPERADOR:{id:'uo',rol:'OPERADOR',operador:{id:'o'}},ADMIN:{id:'ua',rol:'ADMIN'}};
const req=(rol:keyof typeof users,body={})=>({params:{id:'m'},user:users[rol],body} as any);
const signature={imagen:'signed-image',sha256:'signed-hash'};
beforeEach(()=>{
 vi.unstubAllEnvs();vi.stubEnv('ENTERPRISE_ENABLED','false');
 mock.manifest={id:'m',numero:'CAP-TEST',estado:'PENDIENTE_APROBACION',...p,generador:{cuit:'QA-G'},transportista:{cuit:'QA-T'},operador:{cuit:'QA-O'},residuos:[],fechaEstimadaRetiro:new Date('2026-10-19T15:00:00Z')};
 mock.events=[{id:'marker',tipo:MANIFEST_PROPOSAL,descripcion:JSON.stringify(p)}];
 mock.tx={$queryRaw:vi.fn(),manifiesto:{count:vi.fn(async()=>3),findUnique:vi.fn(async()=>mock.manifest),findUniqueOrThrow:vi.fn(async()=>mock.manifest),update:vi.fn(async({data}:any)=>Object.assign(mock.manifest,data))},eventoManifiesto:{
 count:vi.fn(async()=>mock.events.length),update:vi.fn(async({where,data}:any)=>Object.assign(mock.events.find(e=>e.id===where.id),data)),
 findFirst:vi.fn(async()=>mock.events.find(e=>e.tipo===MANIFEST_PROPOSAL)),findMany:vi.fn(async(args:any)=>mock.events.filter(e=>args?.where?.tipo===MANIFEST_PROPOSAL?e.tipo===MANIFEST_PROPOSAL:e.tipo!==MANIFEST_PROPOSAL)),create:vi.fn(async({data}:any)=>{const e={...data,id:String(mock.events.length),createdAt:new Date()};mock.events.push(e);return e;})},
 generador:{findUnique:vi.fn(async()=>({usuario:{id:'ug',activo:true}}))},transportista:{findUnique:vi.fn(async()=>({usuario:{id:'ut',activo:true}}))},operador:{findUnique:vi.fn(async()=>({usuario:{id:'uo',activo:true}}))},notificacion:{createMany:vi.fn(async({data}:any)=>({count:data.length}))}};
});
describe('three independently authenticated parties',()=>{
 it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('individual %s approval notice asks for the current status rather than asserting a missing approval',async role=>{
  await notifyManifestParties(mock.tx,mock.manifest,'aprobacion-'+role,users[role as keyof typeof users].id,role);
  const notices=mock.tx.notificacion.createMany.mock.calls[0][0].data;
  expect(notices).toHaveLength(3);
  for(const notice of notices){
   expect(notice.mensaje).toContain('Consultá el estado actual de las aprobaciones.');
   expect(notice.mensaje).not.toContain('qué aprobaciones faltan');
  }
 });
 it('records the mode and required parties in origin coordination notices',async()=>{
  mock.manifest.modalidad='IN_SITU';
  await notifyManifestParties(mock.tx,mock.manifest,'iniciada','uo');
  const notices=mock.tx.notificacion.createMany.mock.calls[0][0].data;
  expect(notices.map((n:any)=>n.usuarioId).sort()).toEqual(['ug','uo','ut']);
  for(const notice of notices){
   expect(JSON.parse(notice.datos)).toMatchObject({tipo:'propuesta_partes',fase:'iniciada',modalidad:'IN_SITU',partesRequeridas:3});
   expect(notice.mensaje).toContain('No hay retiro, viaje ni GPS');
  }
 });
 it('gives all linked parties an actionable notice with the proposing company and the same manifest link',async()=>{
  for(const [actor,id,name] of [['generador','ug','Origen artificial'],['transportista','ut','Transporte artificial'],['operador','uo','Destino artificial']]){
   mock.tx[actor].findUnique.mockResolvedValue({razonSocial:name,usuario:{id,activo:true}});
  }
  await notifyManifestParties(mock.tx,mock.manifest,'creada','ug');
  const notices=mock.tx.notificacion.createMany.mock.calls[0][0].data;
  expect(notices.map((n:any)=>n.usuarioId).sort()).toEqual(['ug','uo','ut']);
  for(const notice of notices){
   expect(notice.titulo).toBe('Manifiesto pendiente de tu aprobación');
   expect(notice.mensaje).toContain('Origen artificial (Generador) propuso este manifiesto');
   expect(notice.mensaje).toContain('Transporte: Transporte artificial');
   expect(notice.mensaje).toContain('Operador: Destino artificial');
   expect(notice.mensaje).toContain('Abrí el manifiesto para aprobar o rechazar.');
   expect(JSON.parse(notice.datos).url).toBe('/manifiestos/m');
  }
 });
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
  expect(JSON.parse(vi.mocked(QRCode.toDataURL).mock.calls.at(-1)![0] as string)).toMatchObject({id:'m',numero:'CAP-TEST'});
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
 it.each(['true','false'])('does not start a historical record without three recorded approvals when proposals are %s',async flag=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED',flag);
  mock.events=[];await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409,message:expect.stringContaining('tres aprobaciones')});
 });
 it.each([['FIJO','true'],['FIJO','false'],['IN_SITU','true'],['IN_SITU','false']] as const)('does not activate a historical %s draft with proposals %s',async (modalidad,flag)=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED',flag);
  mock.events=[];Object.assign(mock.manifest,{estado:'BORRADOR',modalidad});
  const {firmarManifiesto}=await import('../controllers/manifiesto-workflow.controller');
  const next=vi.fn(),json=vi.fn();
  await inOperationalSession(()=>firmarManifiesto(req('GENERADOR'),{json} as any,next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409,message:expect.stringContaining('tres aprobaciones')}));
  expect(mock.tx.manifiesto.update).not.toHaveBeenCalled();
  expect(mock.tx.eventoManifiesto.create).not.toHaveBeenCalled();
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
  expect(JSON.stringify(mock.tx.manifiesto.findMany.mock.calls[0][0].where)).toContain('"operadorId":"o"');
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
 it('includes scheduled pending and historical records only when the client asks for them',async()=>{
  const {getProposalAgenda}=await import('../controllers/manifest-proposal.controller');
  mock.tx.manifiesto.findMany=vi.fn(async()=>[]);mock.tx.manifiesto.count=vi.fn(async()=>0);
  const json=vi.fn(),next=vi.fn();
  await inTrainingSession(()=>getProposalAgenda({...req('OPERADOR'),query:{incluirPendientes:'true'}} as any,{json} as any,next));
  expect(next).not.toHaveBeenCalled();
  const where=mock.tx.manifiesto.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({operadorId:'o',estado:{in:['PENDIENTE_APROBACION','APROBADO']}});
  expect(where).not.toHaveProperty('eventos');
 });
 it('rejects an invalid pending filter',async()=>{
  const {getProposalAgenda}=await import('../controllers/manifest-proposal.controller');const next=vi.fn();mock.tx.manifiesto.findMany=vi.fn();
  await inTrainingSession(()=>getProposalAgenda({...req('OPERADOR'),query:{incluirPendientes:'yes'}} as any,{json:vi.fn()} as any,next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(mock.tx.manifiesto.findMany).not.toHaveBeenCalled();
 });
 it('reports proposal readiness in scheduled rows without exposing event payloads',async()=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  const {getProposalAgenda}=await import('../controllers/manifest-proposal.controller');
  const bad={...mock.manifest,estado:'APROBADO',eventos:[{tipo:MANIFEST_PROPOSAL,descripcion:'{'}]};
  const waiting={...mock.manifest,id:'ready-to-coordinate',estado:'APROBADO',eventos:[
   {tipo:MANIFEST_PROPOSAL,descripcion:JSON.stringify(p)},
   ...[['FIRMA','GENERADOR','g'],['APROBACION_TRANSPORTISTA','TRANSPORTISTA','t'],['APROBACION_OPERADOR','OPERADOR','o']].map(([tipo,rol,actorId])=>({tipo,usuarioId:'u',descripcion:JSON.stringify({version:1,rol,actorId,decision:'APROBADA'})})),
  ]};
  mock.tx.manifiesto.findMany=vi.fn(async()=>[bad,waiting]);mock.tx.manifiesto.count=vi.fn(async()=>2);
  const json=vi.fn(),next=vi.fn();await inOperationalSession(()=>getProposalAgenda({...req('OPERADOR'),query:{}} as any,{json} as any,next));
  expect(next).not.toHaveBeenCalled();
  expect(json.mock.calls[0][0].data.items.map((item:any)=>item.aprobacionOperacion)).toEqual(['INCONSISTENTE','FALTA_COORDINACION']);
  expect(json.mock.calls[0][0].data.items[0]).not.toHaveProperty('eventos');
  expect(json.mock.calls[0][0].data.items[0]).not.toHaveProperty('generadorId');
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


describe('operational three-party proposals', () => {
 it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'] as const)('permits %s only with the separate operational flag', role => {
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  expect(inOperationalSession(()=>canCreateManifestProposal(users[role]))).toBe(true);
  expect(inOperationalSession(()=>canCreateManifestProposal({...users[role],restricted:true}))).toBe(false);
  expect(inOperationalSession(()=>canCreateManifestProposal({...users[role],impersonatedBy:'ua'} as any))).toBe(false);
 });
 it('never allows impersonation to approve a party', () => {
  expect(proposalRole({...users.OPERADOR,impersonatedBy:'ua'} as any,p)).toBeNull();
  expect(proposalRole({...users.OPERADOR,operador:{id:'o',activo:false}},p)).toBeNull();
 });
 it('does not bypass a persisted proposal when the flag is off', async () => {
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','false');
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 });
 it('blocks starting a legacy record without recorded approvals', async () => {
  mock.events=[];
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 });
});

describe('operational decisions and integrity',()=>{
 it.each([
  ['GENERADOR','TRANSPORTISTA','OPERADOR'], ['GENERADOR','OPERADOR','TRANSPORTISTA'],
  ['TRANSPORTISTA','GENERADOR','OPERADOR'], ['TRANSPORTISTA','OPERADOR','GENERADOR'],
  ['OPERADOR','GENERADOR','TRANSPORTISTA'], ['OPERADOR','TRANSPORTISTA','GENERADOR'],
 ] as const)('requires each decision in order %s / %s / %s and notifies all three at every stage',async(first,second,third)=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  const {getManifestProposal}=await import('../controllers/manifest-proposal.controller');
  await notifyManifestParties(mock.tx,mock.manifest,'creada',users[first].id);
  for(const [index,role] of [first,second,third].entries()){
   await inOperationalSession(()=>approveManifestProposal(req(role),role==='GENERADOR'?signature:undefined));
   expect(mock.manifest.estado).toBe(index===2?'APROBADO':'PENDIENTE_APROBACION');
   const json=vi.fn(),next=vi.fn();
   await inOperationalSession(()=>getManifestProposal(req(first),{json} as any,next));
   expect(next).not.toHaveBeenCalled();
   expect(json.mock.calls[0][0].data.partes.filter((p:any)=>p.aprobada)).toHaveLength(index+1);
   expect(json.mock.calls[0][0].data.puedeIniciar).toBe(index===2);
   await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
   if(index<2){
    const blocked=vi.fn();
    await inOperationalSession(()=>startManifestCoordination(req(first),{json:vi.fn()} as any,blocked));
    expect(blocked).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));
   }
  }
  const next=vi.fn();await inOperationalSession(()=>startManifestCoordination(req(first),{json:vi.fn()} as any,next));
  expect(next).not.toHaveBeenCalled();
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).resolves.toBeUndefined();
  expect(mock.tx.notificacion.createMany).toHaveBeenCalledTimes(5);
  const ids:string[]=[];
  for(const [call] of mock.tx.notificacion.createMany.mock.calls){
   expect(call.data.map((n:any)=>n.usuarioId).sort()).toEqual(['ug','uo','ut']);
   for(const notice of call.data){ids.push(notice.id);expect(JSON.parse(notice.datos).url).toBe('/manifiestos/m');}
  }
  expect(new Set(ids).size).toBe(15);
  await inOperationalSession(()=>approveManifestProposal(req(third),third==='GENERADOR'?signature:undefined));
  await inOperationalSession(()=>startManifestCoordination(req(first),{json:vi.fn()} as any,next));
  expect(mock.tx.notificacion.createMany).toHaveBeenCalledTimes(5);
 });
 it('does not offer coordination when status says approved but one recorded decision is missing',async()=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  await inOperationalSession(()=>approveManifestProposal(req('GENERADOR'),signature));
  await inOperationalSession(()=>approveManifestProposal(req('OPERADOR')));
  mock.manifest.estado='APROBADO';
  const {getManifestProposal}=await import('../controllers/manifest-proposal.controller');
  const json=vi.fn(),next=vi.fn();await inOperationalSession(()=>getManifestProposal(req('OPERADOR'),{json} as any,next));
  expect(next).not.toHaveBeenCalled();
  expect(json.mock.calls[0][0].data.puedeIniciar).toBe(false);
  expect(json.mock.calls[0][0].data.partes).toContainEqual(expect.objectContaining({rol:'TRANSPORTISTA',aprobada:false}));
  const {getTrainingTasks}=await import('../controllers/manifest-proposal.controller');
  mock.tx.manifiesto.findMany=vi.fn(async()=>[{...mock.manifest,eventos:mock.events,residuos:[]}]);
  json.mockClear();await inOperationalSession(()=>getTrainingTasks(req('OPERADOR'),{json} as any,next));
  expect(json.mock.calls[0][0].data.items[0]).toMatchObject({action:'Revisar aprobaciones',detail:'Falta aprobar: transporte. No se puede iniciar.'});
 });
 it('records three authenticated approvals and operational coordination, with integrity and idempotent notices',async()=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  for (const role of ['OPERADOR','GENERADOR','TRANSPORTISTA'] as const) {
   await inOperationalSession(()=>approveManifestProposal(req(role),role==='GENERADOR'?signature:undefined));
   await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
  }
  expect(mock.manifest.estado).toBe('APROBADO');
  expect(JSON.parse(vi.mocked(QRCode.toDataURL).mock.calls.at(-1)![0] as string)).toMatchObject({id:'m',numero:'CAP-TEST'});
  expect(mock.events.filter(e=>e.tipo!==MANIFEST_PROPOSAL).every(e=>/^[a-f0-9]{64}$/.test(e.integrityHash))).toBe(true);
  const next=vi.fn(),res={json:vi.fn()} as any;
  await inOperationalSession(()=>startManifestCoordination(req('OPERADOR'),res,next));
  expect(next).not.toHaveBeenCalled();expect(mock.events.filter(e=>e.tipo==='INICIO_COORDINACION')).toHaveLength(1);
  await inOperationalSession(()=>approveManifestProposal(req('TRANSPORTISTA')));
  await inOperationalSession(()=>startManifestCoordination(req('TRANSPORTISTA'),res,next));
  expect(mock.tx.notificacion.createMany).toHaveBeenCalledTimes(4);
  expect(mock.manifest.fechaRetiro).toBeUndefined();
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','false');
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).resolves.toBeUndefined();
 });
 it('rejects, records its reason and never unlocks pickup',async()=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  await inOperationalSession(()=>approveManifestProposal(req('OPERADOR',{decision:'RECHAZADA',motivo:'No recibimos esta corriente'})));
  expect(mock.manifest.estado).toBe('RECHAZADO');expect(mock.events.at(-1).integrityHash).toMatch(/^[a-f0-9]{64}$/);
  await expect(inOperationalSession(()=>approveManifestProposal(req('GENERADOR'),signature))).rejects.toMatchObject({statusCode:409});
 });
});

describe('in-situ agreement with three approvals and no trip',()=>{
 const inSitu={...p,version:2 as const,modalidad:'IN_SITU' as const};
 beforeEach(()=>{
  vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
  Object.assign(mock.manifest,inSitu);
  mock.events[0].descripcion=JSON.stringify(inSitu);
 });
 it.each([
  ['GENERADOR','TRANSPORTISTA','OPERADOR'],['GENERADOR','OPERADOR','TRANSPORTISTA'],
  ['TRANSPORTISTA','GENERADOR','OPERADOR'],['TRANSPORTISTA','OPERADOR','GENERADOR'],
  ['OPERADOR','GENERADOR','TRANSPORTISTA'],['OPERADOR','TRANSPORTISTA','GENERADOR'],
 ] as const)('waits for all three approvals in order %s, %s, %s',async(first,second,third)=>{
  for(const role of [first,second]){
   await inOperationalSession(()=>approveManifestProposal(req(role),role==='GENERADOR'?signature:undefined));
   expect(mock.manifest.estado).toBe('PENDIENTE_APROBACION');
   await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
  }
  const next=vi.fn(),res={json:vi.fn()} as any;
  await inOperationalSession(()=>startManifestCoordination(req('OPERADOR'),res,next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));
  await inOperationalSession(()=>approveManifestProposal(req(third),third==='GENERADOR'?signature:undefined));
  expect(mock.manifest.estado).toBe('APROBADO');next.mockClear();
  await inOperationalSession(()=>startManifestCoordination(req(first),res,next));
  expect(next).not.toHaveBeenCalled();
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).resolves.toBeUndefined();
  expect(mock.manifest.fechaRetiro).toBeUndefined();
  const notices=mock.tx.notificacion.createMany.mock.calls.flatMap(([arg]:any)=>arg.data);
  expect([...new Set(notices.map((n:any)=>n.usuarioId))].sort()).toEqual(['ug','uo','ut']);
  expect(notices.some((n:any)=>n.titulo==='¡Tres aprobaciones! Listos para iniciar')).toBe(true);
  expect(notices.some((n:any)=>n.mensaje.includes('No hay retiro, viaje ni GPS'))).toBe(true);
 });
 it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'] as const)('stops when %s rejects',async role=>{
  await inOperationalSession(()=>approveManifestProposal(req(role,{decision:'RECHAZADA',motivo:'No acordamos el tratamiento'})));
  expect(mock.manifest.estado).toBe('RECHAZADO');
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 });
 it('returns three parties in detail and agenda',async()=>{
  const {getManifestProposal,getTrainingTasks}=await import('../controllers/manifest-proposal.controller');
  const json=vi.fn(),next=vi.fn();
  await inOperationalSession(()=>getManifestProposal(req('OPERADOR'),{json} as any,next));
  expect(next).not.toHaveBeenCalled();
  expect(json.mock.calls[0][0].data).toMatchObject({modalidad:'IN_SITU',partes:[{rol:'GENERADOR',aprobada:false},{rol:'TRANSPORTISTA',aprobada:false},{rol:'OPERADOR',aprobada:false}]});
  mock.tx.manifiesto.findMany=vi.fn(async()=>[{...mock.manifest,eventos:mock.events,residuos:[]}]);
  json.mockClear();await inOperationalSession(()=>getTrainingTasks(req('OPERADOR'),{json} as any,next));
  expect(json.mock.calls[0][0].data.items[0].partes).toHaveLength(3);
 });
 it('requires an active carrier account for the new agreement',async()=>{
  const {validateProposalParties}=await import('../services/manifestProposal.service');
  await expect(validateProposalParties(mock.tx,inSitu)).resolves.toBeUndefined();
  mock.tx.transportista.findUnique.mockResolvedValue({usuario:{id:'ut',activo:false}});
  await expect(validateProposalParties(mock.tx,inSitu)).rejects.toMatchObject({statusCode:400});
 });
 it('recovers a previously committed in-situ send without a carrier, but refuses a new one',async()=>{
  const {createManifiesto}=await import('../controllers/manifiesto.controller');
  const {manifestCreationIntent}=await import('../domain/manifestCreationIntent');
  const key='c84b3820-024e-4e4b-a54a-06c62f40f11a';
  const body={generadorId:'g',operadorId:'o',modalidad:'IN_SITU',fechaEstimadaRetiro:'2099-12-25',residuos:[{tipoResiduoId:'y1',cantidad:1,unidad:'kg'}]};
  const intent=manifestCreationIntent(key,'ug','GENERADOR',undefined,body);
  mock.tx.auditoria={findUnique:vi.fn().mockResolvedValue({usuarioId:'ug',modulo:'MANIFIESTOS',accion:'CREAR_MANIFIESTO',manifiestoId:'m',datosDespues:JSON.stringify({version:1,requestHash:intent.hash})})};
  Object.assign(mock.manifest,{generadorId:'g',operadorId:'o',transportistaId:null,modalidad:'IN_SITU'});
  const json=vi.fn(),status=vi.fn().mockReturnValue({json}),next=vi.fn();
  const request={...req('GENERADOR'),body:{...body,idempotencyKey:key}};
  await inOperationalSession(()=>createManifiesto(request,{status} as any,next));
  expect(next).not.toHaveBeenCalled();expect(status).toHaveBeenCalledWith(200);
  expect(json.mock.calls[0][0].data).toMatchObject({replayed:true,manifiesto:{id:'m',transportistaId:null}});
  expect(mock.tx.eventoManifiesto.create).not.toHaveBeenCalled();
  mock.tx.auditoria.findUnique.mockResolvedValue(null);next.mockClear();
  await inOperationalSession(()=>createManifiesto(request,{status} as any,next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400,message:expect.stringContaining('transportista')}));
  expect(mock.tx.manifiesto.update).not.toHaveBeenCalled();
 });
 it('rejects missing or mismatched parties and protects in-situ reception',async()=>{
  expect(()=>parseProposal(JSON.stringify({...inSitu,transportistaId:null}))).toThrow();
  expect(proposalRoles(parseProposal(JSON.stringify(inSitu)))).toHaveLength(3);
  expect(proposalRole({...users.OPERADOR,impersonatedBy:'ua'},inSitu)).toBeNull();
  mock.manifest.estado='APROBADO';
  const {confirmarRecepcionInSitu}=await import('../controllers/manifiesto-workflow.controller');
  const next=vi.fn();await inOperationalSession(()=>confirmarRecepcionInSitu(req('OPERADOR'),{json:vi.fn()} as any,next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));
  expect(mock.tx.manifiesto.update).not.toHaveBeenCalled();
 });
 it('does not advance an earlier unsigned two-party agreement and explains how to replace it',async()=>{
  const legacy={...p,modalidad:'IN_SITU' as const,transportistaId:null};
  Object.assign(mock.manifest,legacy);mock.events[0].descripcion=JSON.stringify(legacy);
  await expect(inOperationalSession(()=>approveManifestProposal(req('OPERADOR')))).rejects.toMatchObject({statusCode:409,message:expect.stringContaining('nueva propuesta')});
  const {getManifestProposal}=await import('../controllers/manifest-proposal.controller');
  const json=vi.fn(),next=vi.fn();await inOperationalSession(()=>getManifestProposal(req('OPERADOR'),{json} as any,next));
  expect(json.mock.calls[0][0].data).toMatchObject({requiereNuevaPropuesta:true,puedeAprobar:null,puedeRechazar:true});
  expect(mock.events).toHaveLength(1);
 });
 it('preserves the historical signatures but blocks starting reception without a transport approver',async()=>{
  const legacy={...p,modalidad:'IN_SITU' as const,transportistaId:null};
  Object.assign(mock.manifest,legacy,{estado:'APROBADO'});mock.events[0].descripcion=JSON.stringify(legacy);
  mock.events.push({tipo:'FIRMA'},{tipo:'APROBACION_OPERADOR'},{tipo:'INICIO_COORDINACION'});
  await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
  expect(mock.events).toHaveLength(4);
 });
});

it('requires active participant records as well as active accounts',async()=>{
 const {validateProposalParties}=await import('../services/manifestProposal.service');
 mock.tx.operador.findUnique.mockResolvedValue({activo:false,usuario:{id:'uo',activo:true}});
 await expect(validateProposalParties(mock.tx,p)).rejects.toMatchObject({statusCode:400});
});

it('identifies old approved trips and in-situ receipts as requiring a new three-party proposal',async()=>{
 vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
 const {getTrainingTasks}=await import('../controllers/manifest-proposal.controller');
 mock.tx.manifiesto.findMany=vi.fn(async()=>['FIJO','IN_SITU'].map(modalidad=>({...mock.manifest,estado:'APROBADO',modalidad,eventos:[],residuos:[]})));
 const json=vi.fn(),next=vi.fn();await inOperationalSession(()=>getTrainingTasks(req('OPERADOR'),{json} as any,next));
 expect(next).not.toHaveBeenCalled();expect(json.mock.calls[0][0].data.items.map((m:any)=>[m.action,m.partes,m.requiereNuevaPropuesta])).toEqual([['Necesita nueva propuesta',null,true],['Necesita nueva propuesta',null,true]]);
});

it('isolates damaged and missing proposals without hiding other current work',async()=>{
 vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
 const {getTrainingTasks}=await import('../controllers/manifest-proposal.controller');
 const row=(id:string,estado:string,eventos:any[])=>({...mock.manifest,id,numero:id,estado,eventos,residuos:[]});
 const marker=(descripcion:string)=>({tipo:MANIFEST_PROPOSAL,descripcion});
 const ok=marker(JSON.stringify(p));
 mock.tx.manifiesto.findMany=vi.fn(async()=>[
  row('missing','PENDIENTE_APROBACION',[]),
  row('invalid','PENDIENTE_APROBACION',[marker('{')]),
  row('mismatch','APROBADO',[marker(JSON.stringify({...p,operadorId:'other'}))]),
  row('duplicate','APROBADO',[ok,ok]),
  row('rejected','APROBADO',[ok,{tipo:'RECHAZO_PARTE'}]),
  row('bad-evidence','PENDIENTE_APROBACION',[ok,{tipo:'APROBACION_OPERADOR',usuarioId:'uo',descripcion:JSON.stringify({version:1,rol:'OPERADOR',actorId:'otro',decision:'APROBADA'})}]),
  row('trip','EN_TRANSITO',[marker('{')]),
  row('normal','PENDIENTE_APROBACION',[ok]),
 ]);
 const json=vi.fn(),next=vi.fn();await inOperationalSession(()=>getTrainingTasks(req('OPERADOR'),{json} as any,next));
 expect(next).not.toHaveBeenCalled();
 const result=json.mock.calls[0][0].data.items;
 for(const id of ['missing','invalid','mismatch','duplicate','rejected','bad-evidence']) expect(result.find((item:any)=>item.id===id)).toMatchObject({action:'Propuesta por revisar',requiereRevisionPropuesta:true,requiereMiAprobacion:false,partes:null});
 expect(result.find((item:any)=>item.id==='trip')).toMatchObject({action:'El transporte está en viaje',advertenciaPropuesta:true});
 expect(result.find((item:any)=>item.id==='normal')).toMatchObject({requiereMiAprobacion:true,requiereRevisionPropuesta:false});
});

it('does not advance if an approval points to a different actor',async()=>{
 vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
 mock.events.push({tipo:'APROBACION_TRANSPORTISTA',usuarioId:'ut',descripcion:JSON.stringify({version:1,rol:'TRANSPORTISTA',actorId:'other',decision:'APROBADA'})});
 await expect(inOperationalSession(()=>approveManifestProposal(req('OPERADOR')))).rejects.toMatchObject({statusCode:409});
 await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 expect(mock.tx.eventoManifiesto.create).not.toHaveBeenCalled();
 expect(mock.tx.manifiesto.update).not.toHaveBeenCalled();
});

it('refuses an ambiguous duplicate proposal before any approval or movement',async()=>{
 vi.stubEnv('MANIFEST_PROPOSALS_ENABLED','true');
 mock.events.push({id:'marker-2',tipo:MANIFEST_PROPOSAL,descripcion:JSON.stringify(p)});
 await expect(inOperationalSession(()=>approveManifestProposal(req('OPERADOR')))).rejects.toMatchObject({statusCode:409});
 await expect(inOperationalSession(()=>assertManifestProposalApproved(mock.tx,'m'))).rejects.toMatchObject({statusCode:409});
 expect(mock.tx.eventoManifiesto.create).not.toHaveBeenCalled();
 expect(mock.tx.manifiesto.update).not.toHaveBeenCalled();
});
