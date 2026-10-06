import { beforeEach,describe,expect,it,vi } from 'vitest';
const db=vi.hoisted(()=>({manifiesto:{count:vi.fn(),groupBy:vi.fn(),findMany:vi.fn()},generador:{count:vi.fn()},operador:{count:vi.fn()},manifiestoResiduo:{aggregate:vi.fn()},$queryRaw:vi.fn(),$queryRawUnsafe:vi.fn()}));
vi.mock('../lib/prisma',()=>({default:db}));
import { getActividadCentroControl } from '../controllers/tracking.controller';
const query={capas:'',fechaDesde:'2026-10-01',fechaHasta:'2026-10-01'};
beforeEach(()=>{vi.resetAllMocks();db.manifiesto.count.mockResolvedValue(5);db.manifiesto.groupBy.mockResolvedValue([{estado:'APROBADO',_count:{_all:2}},{estado:'CANCELADO',_count:{_all:3}}]);db.generador.count.mockResolvedValue(1);db.operador.count.mockResolvedValue(1);db.manifiestoResiduo.aggregate.mockResolvedValue({_sum:{cantidad:0}});db.$queryRaw.mockResolvedValue([{estado:'APROBADO',cnt:1n}]);db.$queryRawUnsafe.mockResolvedValue([]);});
async function invoke(){const res={json:vi.fn()},next=vi.fn();await getActividadCentroControl({query} as never,res as never,next);return{res,next,stats:res.json.mock.calls[0]?.[0].data.estadisticas};}
describe('tracking distribution uses the created-period cohort without replacing stage activity',()=>{
 it.each([
  [{rol:'TRANSPORTISTA',transportista:{id:'qa-owner'}},true],
  [{rol:'TRANSPORTISTA',transportista:{id:'qa-other'}},false],
  [{rol:'GENERADOR',generador:{id:'qa-generator'}},true],
  [{rol:'OPERADOR',operador:{id:'qa-other'}},false],
  [{rol:'ADMIN'},true],
  [{rol:'ADMIN_GENERADOR'},true],
  [{rol:'GENERADOR',esInspector:true},true],
  [{rol:'TRANSPORTISTA'},false],
 ])('exposes global trips but marks private detail using the existing manifest permission: %j',async(user,allowed)=>{
  db.manifiesto.findMany.mockResolvedValue([{id:'qa-trip',numero:'QA-VIAJE',transportistaId:'qa-owner',generadorId:'qa-generator',operadorId:'qa-operator',transportista:{razonSocial:'QA Transporte'},generador:null,operador:null,tracking:[]}]);
  const res={json:vi.fn()},next=vi.fn();
  await getActividadCentroControl({query:{...query,capas:'transito'},user} as never,res as never,next);
  expect(next).not.toHaveBeenCalled();
  expect(res.json.mock.calls[0][0].data.enTransito).toEqual([expect.objectContaining({manifiestoId:'qa-trip',canViewDetail:allowed})]);
  expect(db.manifiesto.findMany.mock.calls[0][0].where).not.toHaveProperty('transportistaId');
  expect(db.manifiesto.findMany.mock.calls[0][0].select).toMatchObject({generadorId:true,transportistaId:true,operadorId:true});
  expect(res.json.mock.calls[0][0].data.enTransito[0]).not.toHaveProperty('transportistaId');
 });
 it('returns cancellations, total and distribution from one grouped cohort while preserving the operational pipeline',async()=>{const {stats,next}=await invoke();expect(next).not.toHaveBeenCalled();expect(db.manifiesto.groupBy).toHaveBeenCalledWith({by:['estado'],where:{createdAt:{gte:new Date('2026-10-01T03:00:00Z'),lte:new Date('2026-10-02T02:59:59.999Z')}},_count:{_all:true}});expect(stats.totalManifiestos).toBe(5);expect(stats.distribucionPorEstado).toEqual({APROBADO:2,CANCELADO:3});expect(stats.porEstado.APROBADO).toBe(1);}),
 it('returns an empty real cohort without a made-up denominator',async()=>{db.manifiesto.groupBy.mockResolvedValue([]);const {stats,next}=await invoke();expect(next).not.toHaveBeenCalled();expect(stats.totalManifiestos).toBe(0);expect(stats.distribucionPorEstado).toEqual({});}),
 it('propagates aggregation failure instead of returning a misleading zero',async()=>{const error=new Error('aggregation unavailable');db.manifiesto.groupBy.mockRejectedValue(error);const {res,next}=await invoke();expect(res.json).not.toHaveBeenCalled();expect(next).toHaveBeenCalledWith(error);});
});

describe('Control uses the same civil days as the Mendoza period selector',()=>{
 it('includes the final three UTC hours belonging to the selected Mendoza day',async()=>{
  const {next}=await invoke();expect(next).not.toHaveBeenCalled();
  expect(db.manifiesto.groupBy.mock.calls[0][0].where.createdAt).toEqual({
   gte:new Date('2026-10-01T03:00:00Z'),lte:new Date('2026-10-02T02:59:59.999Z'),
  });
 });
 it('does not expand an explicitly supplied timestamp at UTC midnight',async()=>{
  const next=vi.fn();await getActividadCentroControl({query:{capas:'',fechaDesde:'2026-10-01T00:00:00Z',fechaHasta:'2026-10-02T00:00:00Z'}} as never,{json:vi.fn()} as never,next);
  expect(next).not.toHaveBeenCalled();
  expect(db.manifiesto.groupBy.mock.calls[0][0].where.createdAt).toEqual({gte:new Date('2026-10-01T00:00:00Z'),lte:new Date('2026-10-02T00:00:00Z')});
 });
 it('rejects an impossible civil date before reading business data',async()=>{
  const next=vi.fn();await getActividadCentroControl({query:{capas:'',fechaDesde:'2026-02-30',fechaHasta:'2026-03-01'}} as never,{json:vi.fn()} as never,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));
  expect(db.manifiesto.groupBy).not.toHaveBeenCalled();
 });
});
