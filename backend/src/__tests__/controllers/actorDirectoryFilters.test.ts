import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({operators:vi.fn(),operatorCount:vi.fn(),transports:vi.fn(),transportCount:vi.fn(),query:vi.fn()}));
vi.mock('../../lib/prisma',()=>({default:{operador:{findMany:mock.operators,count:mock.operatorCount},transportista:{findMany:mock.transports,count:mock.transportCount},$queryRaw:mock.query}}));
vi.mock('../../utils/logger',()=>({default:{error:vi.fn(),info:vi.fn(),warn:vi.fn()}}));
import { getOperadores, getTransportistas } from '../../controllers/actor.controller';
import { directoryText, operatorDirectoryQuery } from '../../services/actorDirectoryFilters';
describe('Directory-wide filters precede pagination',()=>{
 beforeEach(()=>{vi.clearAllMocks();mock.query.mockResolvedValue([{id:'qa-beyond-first-page'}]);mock.operators.mockResolvedValue([]);mock.operatorCount.mockResolvedValue(23);mock.transports.mockResolvedValue([]);mock.transportCount.mockResolvedValue(21);});
 it('uses identical complete operator filters for count and rows without removing actor scope',async()=>{
  const next=vi.fn(),res={json:vi.fn()};
  await getOperadores({query:{tipoOperador:'IN SITU',corriente:'Y8',search:'QA',activo:'false',page:'2',limit:'20'},user:{id:'staff',rol:'ADMIN'}} as never,res as never,next);
  expect(next).not.toHaveBeenCalled();
  const args=mock.operators.mock.calls[0][0];
  expect(args).toMatchObject({skip:20,take:20,where:{activo:false,AND:[{id:{in:['qa-beyond-first-page']}}]}});
  expect(mock.operatorCount).toHaveBeenCalledWith({where:args.where});
  expect(res.json.mock.calls[0][0].data.pagination).toMatchObject({total:23,pages:2});
  expect(mock.query.mock.calls[0][0].values).toContain('(^|[^[:alnum:]])Y8([^[:alnum:]]|$)');
 });
 it('gets locality choices from every authorized page independently of selected locality',async()=>{
  mock.transports.mockImplementation(args=>Promise.resolve(args.distinct?[{localidad:'Tunuyán'},{localidad:'Maipú'},{localidad:null}]:[]));
  const next=vi.fn(),res={json:vi.fn()};
  await getTransportistas({query:{localidad:'Tunuyán',search:'QA',activo:'true',page:'2',limit:'20'},user:{id:'staff',rol:'ADMIN'}} as never,res as never,next);
  expect(next).not.toHaveBeenCalled();
  const rows=mock.transports.mock.calls.find(([args])=>args.take)[0], facets=mock.transports.mock.calls.find(([args])=>args.distinct)[0];
  expect(rows).toMatchObject({skip:20,take:20,where:{localidad:{equals:'Tunuyán',mode:'insensitive'},activo:true}});
  expect(mock.transportCount).toHaveBeenCalledWith({where:rows.where});
  expect(facets.where).toHaveProperty('OR');expect(facets.where).not.toHaveProperty('localidad');expect(facets).not.toHaveProperty('take');
  expect(res.json.mock.calls[0][0].data.localidades).toEqual(['Tunuyán','Maipú']);
 });
 it('intersects advanced filters with the current actor scope',async()=>{
  const next=vi.fn(),res={json:vi.fn()};
  await getOperadores({query:{corriente:'Y8'},user:{id:'own-user',rol:'OPERADOR',operador:{id:'own-operator'}}} as never,res as never,next);
  expect(next).not.toHaveBeenCalled();
  expect(mock.operators.mock.calls[0][0].where).toMatchObject({id:'own-operator',AND:[{id:{in:['qa-beyond-first-page']}}]});
 });
 it.each([{tipoOperador:['FIJO']},{tipoOperador:'all'},{corriente:'Y0'},{corriente:'Y80'},{corriente:"Y8' OR true"}])('rejects invalid filters before querying %j',query=>{expect(()=>operatorDirectoryQuery(query)).toThrow();});
 it('binds SQL values and accepts existing underscore mode labels',()=>{
  const query=operatorDirectoryQuery({tipoOperador:'IN_SITU',corriente:'y48'})!;
  expect(query.sql).not.toContain('Y48');expect(query.values).toContain('(^|[^[:alnum:]])Y48([^[:alnum:]]|$)');
  expect(operatorDirectoryQuery({})).toBeUndefined();expect(()=>directoryText(['Mendoza'],'localidad')).toThrow();
 });
});
