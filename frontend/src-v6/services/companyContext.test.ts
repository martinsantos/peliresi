import { expect,it,vi,afterEach } from 'vitest';
import { readCompanyContext,saveCompanyContext,companyHeaders,companyCacheScope } from './companyContext';
import { saveActorActivity } from './actorActivity';
const token=(payload:any)=>'e30.'+btoa(JSON.stringify(payload))+'.signature';
afterEach(()=>{sessionStorage.clear();vi.unstubAllEnvs();});
it('company context is per person/tab, gated and excludes restricted/impersonated sessions',()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const selection={empresaId:'a',actividadId:'g',establecimientoId:'s'};
 saveCompanyContext('u1',selection);
 expect(readCompanyContext(token({id:'u1'}))).toEqual(selection);expect(readCompanyContext(token({id:'u2'}))).toBeNull();
 expect(readCompanyContext(token({id:'u1',restricted:true}))).toBeNull();expect(readCompanyContext(token({id:'u1',impersonatedBy:'admin'}))).toBeNull();
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','false');expect(readCompanyContext(token({id:'u1'}))).toBeNull();
});
it('switching personal/company context is exclusive, malformed selection fails closed, caches separate sites',()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 saveActorActivity('u1','OPERADOR');saveCompanyContext('u1',{empresaId:'a',actividadId:'g',establecimientoId:'s1'});
 expect(sessionStorage.getItem('sitrep_activity:u1')).toBeNull();
 expect(companyHeaders(readCompanyContext(token({id:'u1'}))!)).toMatchObject({'X-SITREP-Empresa':'a','X-SITREP-Establecimiento':'s1'});
 expect(companyCacheScope({empresaId:'a',actividadId:'g',establecimientoId:'s1'})).not.toBe(companyCacheScope({empresaId:'a',actividadId:'g',establecimientoId:'s2'}));
 saveActorActivity('u1','OPERADOR');expect(readCompanyContext(token({id:'u1'}))).toBeNull();
 sessionStorage.setItem('sitrep_company:u1','{"empresaId":"a"}');expect(readCompanyContext(token({id:'u1'}))).toBeNull();
 expect(readCompanyContext('invalid')).toBeNull();
});
