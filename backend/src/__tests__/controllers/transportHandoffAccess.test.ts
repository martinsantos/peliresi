import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import jwt from 'jsonwebtoken';
const mocks=vi.hoisted(()=>({leg:vi.fn(),user:vi.fn(),latest:vi.fn()}));
vi.mock('../../config/config',()=>({config:{JWT_SECRET:'unit-handoff-secret'}}));
vi.mock('../../lib/prisma',()=>({default:{$transaction:async(callback:any)=>callback({tramoTransporte:{findUnique:mocks.leg},usuario:{findUnique:mocks.user}}),trackingGPS:{findFirst:mocks.latest}}}));
vi.mock('../../services/blockchain.service',()=>({computeRollingHash:vi.fn()}));
import {limitedTransportState} from '../../controllers/transport-handoff.controller';
import {inTrainingSession,TRAINING_REALM} from '../../lib/trainingScope';
const id='af1388bc-43f7-4c73-8e9c-c14c46695881';
const token=(extra={})=>jwt.sign({purpose:'transport-leg-gps',jti:'version',...extra},'unit-handoff-secret',{subject:id,audience:'transport-leg-gps',expiresIn:'1h'});
const req=(value:string)=>({params:{tramoId:id},headers:{authorization:'Bearer '+value}}) as any;
const res=()=>({json:vi.fn(),setHeader:vi.fn()}) as any;
beforeEach(()=>{
  vi.clearAllMocks();mocks.leg.mockResolvedValue({id,manifiestoId:'manifest',creadoPorId:'original-user',impersonadoPorId:null,fin:null,accesoVersion:'version',accesoHasta:new Date(Date.now()+3600000),datos:{},orden:1,tipo:'EXTERNO',inicio:new Date(),manifiesto:{id:'manifest',numero:'QA',estado:'EN_TRANSITO',transportistaId:'original',operador:{razonSocial:'QA destino',domicilio:'QA 100'}}});
  mocks.user.mockResolvedValue({activo:true,transportista:{id:'original'}});mocks.latest.mockResolvedValue(null);
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
