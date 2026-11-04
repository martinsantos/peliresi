import { expect,it,vi,afterEach } from 'vitest';
import { readCompanyContext,saveCompanyContext,companyHeaders,companyCacheScope,canUseCompanySection } from './companyContext';
import { saveActorActivity,readActorActivity } from './actorActivity';
const token=(payload:any)=>'e30.'+btoa(JSON.stringify(payload))+'.signature';
afterEach(()=>{sessionStorage.clear();localStorage.clear();vi.unstubAllEnvs();});
it('recovers the selected company/activity/site on reopen without restoring grants from storage',()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const choice={empresaId:'company',actividadId:'operator',establecimientoId:'site'};
 saveCompanyContext('u1',choice);sessionStorage.clear();
 expect(readCompanyContext(token({id:'u2'}))).toBeNull();
 expect(readCompanyContext(token({id:'u1'}))).toEqual(choice);
 expect(Object.keys(JSON.parse(localStorage.getItem('sitrep_company:u1')!))).toEqual(['empresaId','actividadId','establecimientoId']);
});
it('pins the current tab while another chooses a different company, including the personal context',()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const first={empresaId:'one',actividadId:'g'},second={empresaId:'two',actividadId:'o'};
 saveCompanyContext('u1',first);localStorage.setItem('sitrep_company:u1',JSON.stringify(second));
 expect(readCompanyContext(token({id:'u1'}))).toEqual(first);
 sessionStorage.clear();expect(readCompanyContext(token({id:'u1'}))).toEqual(second);
 saveCompanyContext('u1',null);localStorage.setItem('sitrep_company:u1',JSON.stringify(first));
 expect(readCompanyContext(token({id:'u1'}))).toBeNull();
});
it('revocation and explicit personal activity prevent old company selection from returning on reopen',()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const choice={empresaId:'a',actividadId:'g'};
 saveCompanyContext('u1',choice);saveCompanyContext('u1',null);sessionStorage.clear();
 expect(readCompanyContext(token({id:'u1'}))).toBeNull();
 sessionStorage.setItem('sitrep_company:u1',JSON.stringify(choice)); // legacy tab still needs server validation
 expect(readCompanyContext(token({id:'u1'}))).toEqual(choice);
 sessionStorage.clear();expect(readCompanyContext(token({id:'u1'}))).toBeNull();
 saveCompanyContext('u1',choice);saveActorActivity('u1','OPERADOR');sessionStorage.clear();
 expect(readCompanyContext(token({id:'u1'}))).toBeNull();
});
it('migrates an existing tab without replacing a newer remembered choice',()=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');
 const old={empresaId:'a',actividadId:'g'},newer={empresaId:'b',actividadId:'o'};
 sessionStorage.setItem('sitrep_company:u1',JSON.stringify(old));
 expect(readCompanyContext(token({id:'u1'}))).toEqual(old);
 expect(JSON.parse(localStorage.getItem('sitrep_company:u1')!)).toEqual(old);
 localStorage.setItem('sitrep_company:u1',JSON.stringify(newer));
 expect(readCompanyContext(token({id:'u1'}))).toEqual(old);
 sessionStorage.clear();expect(readCompanyContext(token({id:'u1'}))).toEqual(newer);
});
it.each(['broken','{"empresaId":"a"}','{"empresaId":"../a","actividadId":"g"}'])('ignores invalid durable context %s',raw=>{
 vi.stubEnv('VITE_ENTERPRISE_ENABLED','true');localStorage.setItem('sitrep_company:u1',raw);
 expect(readCompanyContext(token({id:'u1'}))).toBeNull();
});
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
 expect(sessionStorage.getItem('sitrep_activity:u1')).toBe('');
 expect(localStorage.getItem('sitrep_activity:u1')).toBe('');
 vi.stubEnv('VITE_ACTOR_MULTIROLE_ENABLED','true');expect(readActorActivity(token({id:'u1'}))).toBeNull();
 expect(companyHeaders(readCompanyContext(token({id:'u1'}))!)).toMatchObject({'X-SITREP-Empresa':'a','X-SITREP-Establecimiento':'s1'});
 expect(companyCacheScope({empresaId:'a',actividadId:'g',establecimientoId:'s1'})).not.toBe(companyCacheScope({empresaId:'a',actividadId:'g',establecimientoId:'s2'}));
 saveActorActivity('u1','OPERADOR');expect(readCompanyContext(token({id:'u1'}))).toBeNull();
 sessionStorage.setItem('sitrep_company:u1','{"empresaId":"a"}');expect(readCompanyContext(token({id:'u1'}))).toBeNull();
 expect(readCompanyContext('invalid')).toBeNull();
});
it('a site-limited delegate is not offered legacy company-wide sections',()=>{
 const limited:any={todasSedes:false};
 for(const path of ['/reportes','/centro-control','/admin/usuarios'])expect(canUseCompanySection(limited,path)).toBe(false);
 for(const path of ['/mobile/manifiestos/nuevo','/empresas','/mi-perfil','/ayuda','/soporte'])expect(canUseCompanySection(limited,path)).toBe(true);
 expect(canUseCompanySection(undefined,'/reportes')).toBe(true);
 expect(canUseCompanySection({...limited,todasSedes:true},'/reportes')).toBe(true);
});
