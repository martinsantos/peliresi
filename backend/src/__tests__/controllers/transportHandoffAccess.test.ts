import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import jwt from 'jsonwebtoken';
import {createHash} from 'node:crypto';
const mocks=vi.hoisted(()=>({leg:vi.fn(),user:vi.fn(),latest:vi.fn(),list:vi.fn(),find:vi.fn(),create:vi.fn(),query:vi.fn(),emit:vi.fn(),detect:vi.fn()}));
vi.mock('../../config/config',()=>({config:{JWT_SECRET:'unit-handoff-secret'}}));
vi.mock('../../lib/prisma',()=>({default:{$transaction:async(callback:any)=>callback({tramoTransporte:{findUnique:mocks.leg},usuario:{findUnique:mocks.user},trackingGPS:{findUnique:mocks.find,create:mocks.create},$queryRaw:mocks.query}),trackingGPS:{findFirst:mocks.latest,findMany:mocks.list}}}));
vi.mock('../../services/domainEvent.service',()=>({domainEvents:{emit:mocks.emit}}));
vi.mock('../../controllers/notification.controller',()=>({anomaliaDetector:{detectarAnomalias:mocks.detect}}));
vi.mock('../../services/blockchain.service',()=>({computeRollingHash:vi.fn()}));
import {limitedTransportGps,limitedTransportGpsIdempotent,limitedTransportGpsReceipt,limitedTransportState} from '../../controllers/transport-handoff.controller';
import {inTrainingSession,TRAINING_REALM} from '../../lib/trainingScope';
import {clearGpsAnomalySampling} from '../../services/gpsAnomalySampling.service';
const id='af1388bc-43f7-4c73-8e9c-c14c46695881';
const token=(extra={})=>jwt.sign({purpose:'transport-leg-gps',jti:'version',...extra},'unit-handoff-secret',{subject:id,audience:'transport-leg-gps',expiresIn:'1h'});
const req=(value:string)=>({params:{tramoId:id},headers:{authorization:'Bearer '+value}}) as any;
const res=()=>({json:vi.fn(),setHeader:vi.fn()}) as any;
beforeEach(()=>{
  vi.clearAllMocks();clearGpsAnomalySampling('manifest');mocks.leg.mockResolvedValue({id,manifiestoId:'manifest',creadoPorId:'original-user',impersonadoPorId:null,fin:null,accesoVersion:'version',accesoHasta:new Date(Date.now()+3600000),datos:{},orden:1,tipo:'EXTERNO',inicio:new Date(),manifiesto:{id:'manifest',numero:'QA',estado:'EN_TRANSITO',transportistaId:'original',operador:{razonSocial:'QA destino',domicilio:'QA 100'}}});
  mocks.user.mockResolvedValue({activo:true,transportista:{id:'original'}});mocks.latest.mockResolvedValue(null);mocks.list.mockResolvedValue([]);
  mocks.create.mockResolvedValue({id:'point',timestamp:new Date(),tramoId:id});mocks.find.mockResolvedValue(null);mocks.query.mockResolvedValue([]);
});
afterEach(()=>vi.unstubAllEnvs());
it('refuses a classroom capability outside the classroom scope before querying a manifest',async()=>{
  const next=vi.fn();await limitedTransportState(req(token({realm:TRAINING_REALM})),res(),next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(mocks.leg).not.toHaveBeenCalled();
});
it('revokes a link delegated by an expired direct classroom account without reactivating it',async()=>{
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL','2000-01-01T00:00:00Z');const leg=await mocks.leg();mocks.leg.mockResolvedValue({...leg,creadoPorId:'cap-20261012-transportista-1'});
  const next=vi.fn();await inTrainingSession(()=>limitedTransportState(req(token({realm:TRAINING_REALM})),res(),next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(mocks.user).not.toHaveBeenCalled();expect(mocks.latest).not.toHaveBeenCalled();
});
it('revokes a delegated link when its impersonating instructor is suspended',async()=>{
  const leg=await mocks.leg();mocks.leg.mockResolvedValue({...leg,impersonadoPorId:'instructor'});mocks.user.mockResolvedValueOnce({activo:true,transportista:{id:'original'}}).mockResolvedValueOnce({rol:'ADMIN',activo:false});
  const next=vi.fn();await limitedTransportState(req(token()),res(),next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(mocks.latest).not.toHaveBeenCalled();
});
it('returns only the operational data of the authorized leg, without issuer or credentials',async()=>{
  const response=res(),next=vi.fn();await limitedTransportState(req(token()),response,next);expect(next).not.toHaveBeenCalled();
  const body=response.json.mock.calls[0][0];expect(body.data).toMatchObject({tramoId:id,numero:'QA',destino:'QA destino'});
  for(const key of ['creadoPorId','accesoVersion','accessToken','usuario','generador','residuos'])expect(body.data).not.toHaveProperty(key);
});
it('evaluates configured duration rules for an accepted handoff position, from the original pickup',async()=>{
  const leg=await mocks.leg();mocks.leg.mockResolvedValue({...leg,manifiesto:{...leg.manifiesto,fechaRetiro:new Date(Date.now()-25*3_600_000)}});
  const request={...req(token()),body:{latitud:-33,longitud:-69}};const response=res(),next=vi.fn();
  await limitedTransportGps(request,response,next);
  expect(next).not.toHaveBeenCalled();expect(response.json).toHaveBeenCalledWith(expect.objectContaining({success:true}));
  expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({type:'DURACION_TRANSITO_OBSERVADA',manifiestoId:'manifest',horasTransito:expect.any(Number)}));
  expect(mocks.emit.mock.calls[0][0].horasTransito).toBeGreaterThanOrEqual(25);
  expect(mocks.emit.mock.calls[0][0]).not.toHaveProperty('userId');
});
it('examines only this relay leg and does not attribute its GPS to a user',async()=>{
  const leg=await mocks.leg();
  mocks.leg.mockResolvedValue({...leg,manifiesto:{...leg.manifiesto,
    generador:{latitud:-32.89,longitud:-68.84},
    operador:{...leg.manifiesto.operador,latitud:-34.62,longitud:-68.33}}});
  mocks.list.mockResolvedValue([
    {latitud:-31.4,longitud:-66.0},{latitud:-31.5,longitud:-66.1},{latitud:-31.6,longitud:-66.2},
  ]);
  const response=res(),next=vi.fn();
  await limitedTransportGps({...req(token()),body:{latitud:-31.4,longitud:-66}},response,next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({where:{manifiestoId:'manifest',tramoId:id}}));
  const event=mocks.emit.mock.calls.map(([value])=>value).find(value=>value.tipoAnomalia==='FUERA_CORREDOR_GEOGRAFICO');
  expect(event).toMatchObject({type:'ANOMALIA_GPS',manifiestoId:'manifest'});
  expect(event.descripcion).toMatch(/tramo de relevo 1/i);
  expect(event.descripcion).toMatch(/hora de captura no disponible/i);
  expect(event).not.toHaveProperty('userId');
  expect(JSON.stringify(response.json.mock.calls)).not.toMatch(/generador|latitud.*-32\.89/);
});
it('does not report a corridor observation with fewer than three relay positions',async()=>{
  const leg=await mocks.leg();
  mocks.leg.mockResolvedValue({...leg,manifiesto:{...leg.manifiesto,
    generador:{latitud:-32.89,longitud:-68.84},
    operador:{...leg.manifiesto.operador,latitud:-34.62,longitud:-68.33}}});
  mocks.list.mockResolvedValue([{latitud:-31.4,longitud:-66.0},{latitud:-31.5,longitud:-66.1}]);
  const next=vi.fn();await limitedTransportGps({...req(token()),body:{latitud:-31.4,longitud:-66}},res(),next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({where:{manifiestoId:'manifest',tramoId:id}}));
  expect(mocks.emit.mock.calls.map(([value])=>value).filter(value=>value.tipoAnomalia==='FUERA_CORREDOR_GEOGRAFICO')).toHaveLength(0);
});
it('keeps an acknowledged relay point successful if the later corridor analysis fails',async()=>{
  const leg=await mocks.leg();
  mocks.leg.mockResolvedValue({...leg,manifiesto:{...leg.manifiesto,
    generador:{latitud:-32.89,longitud:-68.84},
    operador:{...leg.manifiesto.operador,latitud:-34.62,longitud:-68.33}}});
  mocks.list.mockRejectedValueOnce(new Error('synthetic query failure'));
  const response=res(),next=vi.fn();
  await limitedTransportGps({...req(token()),body:{latitud:-31.4,longitud:-66}},response,next);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({success:true}));
  expect(next).not.toHaveBeenCalled();
});
it.each([true,false])('keeps the parent manifest practice marker on a relay position: %s',async(isDemoData)=>{
  const leg=await mocks.leg();mocks.leg.mockResolvedValue({...leg,manifiesto:{...leg.manifiesto,isDemoData}});
  const next=vi.fn();await limitedTransportGps({...req(token()),body:{latitud:-33,longitud:-69}},res(),next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({isDemoData})}));
});
it('samples GPS observations from an authorized relay without inventing a user identity',async()=>{
  mocks.detect.mockResolvedValue([]);
  const request={...req(token()),body:{latitud:-33,longitud:-69}};const next=vi.fn();
  for(let i=0;i<10;i++)await limitedTransportGps(request,res(),next);
  await new Promise(resolve=>setImmediate(resolve));
  expect(next).not.toHaveBeenCalled();
  expect(mocks.detect).toHaveBeenCalledWith('manifest',undefined,{automatic:true});
});
it('does not count retries of the same relay GPS point as fresh samples',async()=>{
  const saved=new Map<string,any>();mocks.detect.mockResolvedValue([]);
  mocks.find.mockImplementation(async({where}:any)=>saved.get(where.id)??null);
  mocks.create.mockImplementation(async({data}:any)=>{const point={...data,timestamp:new Date()};saved.set(data.id,point);return point;});
  const request={...req(token()),body:{latitud:-33,longitud:-69,puntoId:'1949916e-22df-4dc1-9d1e-98f98a3eab26'}};
  const next=vi.fn();for(let i=0;i<12;i++)await limitedTransportGpsIdempotent(request,res(),next);
  await new Promise(resolve=>setImmediate(resolve));
  expect(next).not.toHaveBeenCalled();expect(mocks.create).toHaveBeenCalledOnce();expect(mocks.detect).not.toHaveBeenCalled();
});
it('acknowledges the same handoff point once, rejects changed data and respects revocation',async()=>{
  const saved=new Map<string,any>();
  mocks.find.mockImplementation(async({where}:any)=>saved.get(where.id)??null);
  mocks.create.mockImplementation(async({data}:any)=>{const point={...data,timestamp:new Date()};saved.set(data.id,point);return point;});
  const leg=await mocks.leg();mocks.leg.mockResolvedValue({...leg,manifiesto:{...leg.manifiesto,fechaRetiro:new Date(Date.now()-25*3_600_000)}});
  const puntoId='1949916e-22df-4dc1-9d1e-98f98a3eab26';
  const request={...req(token()),body:{latitud:-33,longitud:-69,precision:8,puntoId}};
  const first=res(),retry=res(),next=vi.fn();
  await limitedTransportGpsIdempotent(request,first,next);
  await limitedTransportGpsIdempotent(request,retry,next);
  expect(next).not.toHaveBeenCalled();expect(mocks.create).toHaveBeenCalledOnce();expect(mocks.emit).toHaveBeenCalledOnce();
  expect(first.json.mock.calls[0][0].data.idempotencia).toEqual({version:1,puntoId,repetido:false});
  expect(retry.json.mock.calls[0][0].data.idempotencia).toEqual({version:1,puntoId,repetido:true});
  expect(retry.json.mock.calls[0][0].data.tracking.id).toBe(first.json.mock.calls[0][0].data.tracking.id);
  const changedNext=vi.fn();await limitedTransportGpsIdempotent({...request,body:{...request.body,precision:9}},res(),changedNext);
  expect(changedNext).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));expect(mocks.create).toHaveBeenCalledOnce();
  mocks.leg.mockResolvedValue({...leg,accesoVersion:'revoked'});
  const revokedNext=vi.fn(),revoked=res();await limitedTransportGpsIdempotent(request,revoked,revokedNext);
  expect(revokedNext).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(revoked.json).not.toHaveBeenCalled();
});
it('requires a reference on the new endpoint while leaving the legacy contract unchanged',async()=>{
  const request={...req(token()),body:{latitud:-33,longitud:-69}};
  const next=vi.fn();await limitedTransportGpsIdempotent(request,res(),next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));
  const legacy=res(),legacyNext=vi.fn();await limitedTransportGps(request,legacy,legacyNext);
  expect(legacyNext).not.toHaveBeenCalled();expect(legacy.json.mock.calls[0][0].data.idempotencia).toBeUndefined();
});

it('returns only the matching relay receipt under its still-active capability',async()=>{
  const puntoId='1949916e-22df-4dc1-9d1e-98f98a3eab26';
  mocks.find.mockResolvedValue({id:'private-id',manifiestoId:'manifest',tramoId:id,emisor:'acceso-relevo:version',latitud:-33,longitud:-69,precision:8,velocidad:null,direccion:null});
  const response=res(),next=vi.fn();
  await limitedTransportGpsReceipt({...req(token()),params:{tramoId:id,puntoId}},response,next);
  expect(next).not.toHaveBeenCalled();
  expect(response.json).toHaveBeenCalledWith({success:true,data:{idempotencia:{version:1,puntoId,confirmado:true},tracking:{latitud:-33,longitud:-69,precision:8,velocidad:null,direccion:null}}});
  expect(response.setHeader).toHaveBeenCalledWith('Cache-Control','private, no-store');
  expect(response.setHeader).toHaveBeenCalledWith('Referrer-Policy','no-referrer');
  expect(JSON.stringify(response.json.mock.calls)).not.toContain('private-id');
});
it('keeps a missing, forged, revoked or mismatched relay receipt inaccessible',async()=>{
  const puntoId='1949916e-22df-4dc1-9d1e-98f98a3eab26',request={...req(token()),params:{tramoId:id,puntoId}};
  const missing=res(),next=vi.fn();await limitedTransportGpsReceipt(request,missing,next);
  expect(missing.json.mock.calls[0][0].data).toEqual({idempotencia:{version:1,puntoId,confirmado:false},tracking:null});
  mocks.find.mockResolvedValueOnce({manifiestoId:'other',tramoId:id,emisor:'acceso-relevo:version'});
  const mismatch=vi.fn();await limitedTransportGpsReceipt(request,res(),mismatch);
  expect(mismatch).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));
  mocks.find.mockClear();const leg=await mocks.leg();mocks.leg.mockResolvedValue({...leg,accesoVersion:'rotated'});
  const revoked=vi.fn();await limitedTransportGpsReceipt(request,res(),revoked);
  expect(revoked).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(mocks.find).not.toHaveBeenCalled();
  const forged=vi.fn();await limitedTransportGpsReceipt({...req('forged'),params:{tramoId:id,puntoId}},res(),forged);
  expect(forged).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));
  const invalid=vi.fn();await limitedTransportGpsReceipt({...req(token()),params:{tramoId:id,puntoId:'not-a-uuid'}},res(),invalid);
  expect(invalid).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));
});
it('allows only the current leg capability to check one exact earlier-version receipt',async()=>{
  const old='1949916e-22df-4dc1-9d1e-98f98a3eab26',current='3a999c28-2e6a-4fd0-9127-777a7db7af3e';
  const puntoId='491d2c6e-803c-48d3-a021-23eac2d75a62',leg=await mocks.leg();
  mocks.leg.mockResolvedValue({...leg,accesoVersion:current});
  mocks.find.mockResolvedValue({manifiestoId:'manifest',tramoId:id,emisor:`acceso-relevo:${old}`,latitud:-33,longitud:-69,precision:8,velocidad:null,direccion:null});
  const response=res(),next=vi.fn();
  await limitedTransportGpsReceipt({...req(token({jti:current})),params:{tramoId:id,puntoId},query:{version:old}},response,next);
  expect(next).not.toHaveBeenCalled();
  const key='gpslegv1_'+createHash('sha256').update(JSON.stringify([id,old,puntoId])).digest('hex');
  expect(mocks.find).toHaveBeenCalledWith({where:{id:key}});
  expect(response.json.mock.calls[0][0].data.idempotencia).toEqual({version:1,puntoId,confirmado:true});
  mocks.find.mockClear();const revoked=vi.fn();
  await limitedTransportGpsReceipt({...req(token({jti:old})),params:{tramoId:id,puntoId},query:{version:old}},res(),revoked);
  expect(revoked).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(mocks.find).not.toHaveBeenCalled();
  const bad=vi.fn();await limitedTransportGpsReceipt({...req(token({jti:current})),params:{tramoId:id,puntoId},query:{version:'bad'}},res(),bad);
  expect(bad).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(mocks.find).not.toHaveBeenCalled();
  const other=vi.fn();await limitedTransportGpsReceipt({...req(token({jti:current})),params:{tramoId:'other-leg',puntoId},query:{version:old}},res(),other);
  expect(other).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(mocks.find).not.toHaveBeenCalled();
});
