import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({company:vi.fn(),contexts:vi.fn(),responsible:vi.fn(),events:vi.fn(),users:vi.fn(),project:vi.fn(),capacity:vi.fn()}));
vi.mock('../../lib/prisma',()=>({default:{
 empresa:{findUnique:mocks.company},empresaActividad:{findMany:async()=>[]},establecimientoEmpresa:{findMany:async()=>[]},autorizacionEmpresa:{findMany:async()=>[]},
 responsableEmpresa:{findFirst:mocks.responsible,findMany:async()=>[]},eventoEmpresa:{findMany:mocks.events},invitacionEmpresa:{findMany:async()=>[]},usuario:{findMany:mocks.users},
}}));
vi.mock('../../services/empresa.service',()=>({canAdministerCompanies:(u:any)=>u.rol==='ADMIN',companyContexts:mocks.contexts}));
vi.mock('../../services/companyNotice.service',()=>({withCompanyHistoryContext:mocks.project}));
vi.mock('../../services/companyPeople.service',()=>({companyPeople:mocks.capacity}));
import {getCompany} from '../../controllers/empresa.controller';
beforeEach(()=>{vi.clearAllMocks();mocks.company.mockResolvedValue({id:'company',activa:true});mocks.contexts.mockResolvedValue([]);mocks.responsible.mockResolvedValue(null);mocks.events.mockResolvedValue([{id:'event'}]);mocks.users.mockResolvedValue([]);mocks.project.mockResolvedValue([{id:'event',presentacion:{titulo:'Acceso autorizado',autor:'Revisora'}}]);mocks.capacity.mockResolvedValue({ocupadas:1,maximo:2});});
function request(rol='GENERADOR') {return new Promise<{body?:any;error?:any}>(resolve=>{const res:any={status:()=>res,json:(body:any)=>resolve({body})};getCompany({params:{id:'company'},user:{id:'reader',rol}} as any,res,error=>resolve({error}));});}
it.each(['ADMIN','RESPONSABLE'])('projects history only after confirming management (%s)',async kind=>{
 if(kind==='RESPONSABLE')mocks.responsible.mockResolvedValue({id:'responsibility'});
 const result=await request(kind==='ADMIN'?'ADMIN':'GENERADOR');expect(result.error).toBeUndefined();expect(result.body.data.eventos[0].presentacion.autor).toBe('Revisora');
 expect(mocks.events).toHaveBeenCalledWith({where:{empresaId:'company'},orderBy:{createdAt:'desc'},take:50});expect(mocks.project).toHaveBeenCalledOnce();
});
it('operational access alone never fetches history or names of other people',async()=>{
 mocks.contexts.mockResolvedValue([{empresaId:'company',establecimientos:[]}]);const result=await request();
 expect(result.body.data.eventos).toEqual([]);expect(result.body.data.personas).toEqual([]);expect(result.body.data.puedeGestionar).toBe(false);
 expect(mocks.events).not.toHaveBeenCalled();expect(mocks.project).not.toHaveBeenCalled();expect(mocks.users).not.toHaveBeenCalled();
});
it('a foreign company remains unavailable without revealing history',async()=>{
 const result=await request();expect(result.error).toMatchObject({statusCode:404});expect(mocks.events).not.toHaveBeenCalled();expect(mocks.project).not.toHaveBeenCalled();
});
