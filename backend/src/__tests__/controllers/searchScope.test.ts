import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({manifiesto:{findMany:vi.fn()},generador:{findMany:vi.fn()},transportista:{findMany:vi.fn()},operador:{findMany:vi.fn()}}));
vi.mock('../../lib/prisma',()=>({default:m}));
import {globalSearch} from '../../controllers/search.controller';
beforeEach(()=>{Object.values(m).forEach(model=>model.findMany.mockReset().mockResolvedValue([]));});
async function search(user:any,query:any={q:'QA'}){const res={json:vi.fn()},next=vi.fn();await globalSearch({user,query} as any,res as any,next);return {res,next};}
it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('%s cannot search manifests without its actor association',async rol=>{
 await search({rol});expect(m.manifiesto.findMany.mock.calls[0][0].where.id).toEqual({in:[]});
 for(const model of ['generador','transportista','operador'] as const)expect(m[model].findMany.mock.calls[0][0].where.id).toEqual({in:[]});
});
it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('%s gets only its actor and its manifests',async rol=>{
 const type=rol.toLowerCase();await search({rol,[type]:{id:'own'}});
 expect(m.manifiesto.findMany.mock.calls[0][0].where[type+'Id']).toBe('own');
 for(const model of ['generador','transportista','operador'] as const)expect(m[model].findMany.mock.calls[0][0].where.id).toEqual(model===type?'own':{in:[]});
});
it('uses the existing company/site predicate, while hiding inaccessible company-wide actor fichas',async()=>{
 await search({rol:'GENERADOR',generador:{id:'own'},empresaContexto:{empresaId:'company',establecimientoId:'site',todasSedes:false}});
 expect(m.manifiesto.findMany.mock.calls[0][0].where).toMatchObject({generadorId:'own',AND:[{contextoEmpresa:{path:['establecimientoId'],equals:'site'}},{contextoEmpresa:{path:['empresaId'],equals:'company'}}]});
 for(const model of ['generador','transportista','operador'] as const)expect(m[model].findMany.mock.calls[0][0].where.id).toEqual({in:[]});
});
it.each(['ADMIN','ADMIN_GENERADOR','ADMIN_TRANSPORTISTA','ADMIN_OPERADOR'])('%s retains consultation without granting mutation',async rol=>{
 await search({rol});expect(m.manifiesto.findMany.mock.calls[0][0].where.id).toBeUndefined();expect(m.operador.findMany.mock.calls[0][0].where.id).toBeUndefined();
});
it('inspector keeps existing consultation',async()=>{await search({rol:'GENERADOR',esInspector:true});expect(m.operador.findMany.mock.calls[0][0].where.id).toBeUndefined();});
it('unknown role fails closed',async()=>{await search({rol:'AUDITOR'});expect(m.manifiesto.findMany.mock.calls[0][0].where.id).toEqual({in:[]});});
it.each(['inventado',['TRATADO'],{estado:'TRATADO'}])('rejects malformed state %j before database queries',async estado=>{
 const {next}=await search({rol:'ADMIN'},{q:'QA',estado});expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(m.manifiesto.findMany).not.toHaveBeenCalled();
});
it('rejects oversized searches before database queries',async()=>{const {next}=await search({rol:'ADMIN'},{q:'a'.repeat(201)});expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(m.manifiesto.findMany).not.toHaveBeenCalled();});
it('preserves valid state and deterministic bounded results',async()=>{await search({rol:'ADMIN'},{q:' QA ',estado:'PENDIENTE_APROBACION'});expect(m.manifiesto.findMany.mock.calls[0][0]).toMatchObject({take:5,where:{estado:'PENDIENTE_APROBACION'}});expect(m.generador.findMany.mock.calls[0][0]).toMatchObject({take:3,orderBy:[{razonSocial:'asc'},{id:'asc'}]});});
it('propagates backend failure instead of reporting empty',async()=>{m.generador.findMany.mockRejectedValue(new Error('down'));const {res,next}=await search({rol:'ADMIN'});expect(next).toHaveBeenCalledWith(expect.objectContaining({message:'down'}));expect(res.json).not.toHaveBeenCalled();});
