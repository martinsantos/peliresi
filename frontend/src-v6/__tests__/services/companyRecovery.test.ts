import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { AxiosError } from 'axios';
const mock=vi.hoisted(()=>({get:vi.fn()}));
const token='e30.'+btoa(JSON.stringify({id:'owner'}))+'.signature';
vi.mock('../../services/api',()=>({default:{get:mock.get},getAccessToken:()=>token,setTokensDurably:vi.fn(),clearTokensDurably:vi.fn()}));
import { authService } from '../../services/auth.service';
import { readCompanyContext,saveCompanyContext } from '../../services/companyContext';
const denied=(status:number)=>new AxiosError('denied','ERR_BAD_REQUEST',undefined,undefined,{status,data:{},headers:{},config:{} as never,statusText:'Forbidden'});
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.clearAllMocks();vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');saveCompanyContext('owner',{empresaId:'qa-company',actividadId:'qa-role'});sessionStorage.clear();});
afterEach(()=>vi.unstubAllEnvs());
it('revalidates a restored company, forgets a revoked grant and retrieves only the personal profile',async()=>{
 mock.get.mockRejectedValueOnce(denied(403)).mockResolvedValueOnce({data:{data:{user:{id:'owner',rol:'GENERADOR'}}}});
 expect(await authService.getMe()).toMatchObject({id:'owner',rol:'GENERADOR',empresaContextoError:expect.stringContaining('autorización cambió')});
 expect(mock.get.mock.calls).toEqual([['/auth/profile'],['/auth/profile']]);
 sessionStorage.clear();expect(readCompanyContext(token)).toBeNull();
});
it.each([401,500])('does not switch company to evade %s or replay any business operation',async status=>{
 mock.get.mockRejectedValue(denied(status));await expect(authService.getMe()).rejects.toBeDefined();
 expect(readCompanyContext(token)?.empresaId).toBe('qa-company');expect(mock.get).toHaveBeenCalledOnce();
});
