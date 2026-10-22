import { beforeEach, describe, it, expect, vi } from 'vitest';
import { AxiosError } from 'axios';
const mock=vi.hoisted(()=>({get:vi.fn(),selected:vi.fn(),clear:vi.fn()}));
vi.mock('../../services/api',()=>({default:{get:mock.get},getAccessToken:()=> 'token',setTokensDurably:vi.fn(),clearTokensDurably:vi.fn()}));
vi.mock('../../services/companyContext',()=>({readCompanyContext:()=>null,saveCompanyContext:vi.fn()}));
vi.mock('../../services/actorActivity',()=>({activityOwner:()=> 'owner',readActorActivity:mock.selected,clearActorActivity:mock.clear}));
import { authService } from '../../services/auth.service';
import { identityCuit } from '../../utils/identityCuit';
const denied=(status:number)=>new AxiosError('denied','ERR_BAD_REQUEST',undefined,undefined,{status,data:{message:'Actividad no aprobada'},headers:{},config:{} as never,statusText:'Forbidden'});
beforeEach(()=>{vi.clearAllMocks();mock.selected.mockReturnValue('OPERADOR');});
describe('revoked activity recovery',()=>{
 it('clears only the chosen activity and reloads the personal profile, never a business action',async()=>{
  mock.get.mockRejectedValueOnce(denied(403)).mockResolvedValueOnce({data:{data:{user:{id:'owner',rol:'GENERADOR'}}}});
  expect(await authService.getMe()).toMatchObject({id:'owner',rol:'GENERADOR',actividadContextoError:expect.stringContaining('otra actividad')});
  expect(mock.clear).toHaveBeenCalledWith('owner');expect(mock.get.mock.calls).toEqual([['/auth/profile'],['/auth/profile']]);
 });
 it.each([401,500])('never changes activity to evade a %s response',async status=>{mock.get.mockRejectedValue(denied(status));await expect(authService.getMe()).rejects.toBeDefined();expect(mock.clear).not.toHaveBeenCalled();expect(mock.get).toHaveBeenCalledOnce();});
 it('does not invent a profile if the personal request also fails',async()=>{mock.get.mockRejectedValue(denied(403));await expect(authService.getMe()).rejects.toBeDefined();expect(mock.get).toHaveBeenCalledTimes(2);});
 it('does not retry a permission denial without a selected activity',async()=>{mock.selected.mockReturnValue(null);mock.get.mockRejectedValue(denied(403));await expect(authService.getMe()).rejects.toBeDefined();expect(mock.get).toHaveBeenCalledOnce();});
});
describe('CUIT at registration, before requesting documents',()=>{
 it.each(['20-12345678-6','20123456786',' 20 12345678 6 '])('accepts the check digit for %s without asserting fiscal registration',value=>expect(identityCuit(value)).toBe(true));
 it.each(['20-12345678-5','99-12345678-6','abc','20-1234567-6'])('rejects malformed identity %s',value=>expect(identityCuit(value)).toBe(false));
});
