import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ invitation: vi.fn(), user: vi.fn(), fresh: vi.fn(), transaction: vi.fn(), compare: vi.fn(), manager: vi.fn(), scope: vi.fn(), reserve: vi.fn(), event: vi.fn(), grantFind: vi.fn(), grantCreate: vi.fn(), grantUpdate: vi.fn(), inviteUpdate: vi.fn(), userUpdate: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { invitacionEmpresa: { findUnique: m.invitation }, usuario: { findUnique: m.user }, $transaction: m.transaction } }));
vi.mock('bcryptjs', () => ({ default: { compare: m.compare } }));
vi.mock('../../services/empresa.service', () => ({ canAdministerCompanies: vi.fn(), requireCompanyManager: m.manager, checkCompanyScope: m.scope, enterpriseEvent: m.event, companyContexts: vi.fn(), accessibleCompanyIds: vi.fn() }));
vi.mock('../../services/companyPeople.service', () => ({ companyPeople: vi.fn(), reserveCompanyPerson: m.reserve }));
import { acceptInvitation, getInvitation } from '../../controllers/empresa.controller';
const pending = { id: 'invite', empresaId: 'company', actividadId: 'activity', email: 'member@qa.invalid', creadaPor: 'owner', venceAt: new Date(Date.now()+86400000), aceptadaAt: null, aceptadaPor: null, revocadaAt: null, todosEstablecimientos: true, establecimientoIds: [] };
const member = { id: 'member', email: pending.email, password: 'password-hash', activo: true, emailVerified: true, rol: 'GENERADOR', motivoInactividad: null };
let current: any;
beforeEach(() => {
 vi.clearAllMocks();current={...pending};m.invitation.mockImplementation(async()=>current);m.user.mockImplementation(async query=>query.where.id==='owner'?{id:'owner',activo:true}:member);m.fresh.mockResolvedValue(member);m.compare.mockResolvedValue(true);m.scope.mockResolvedValue({id:'activity',rol:'GENERADOR'});m.grantFind.mockResolvedValue(null);m.grantCreate.mockResolvedValue({id:'grant',activa:true});
 m.inviteUpdate.mockImplementation(async({data})=>{current={...current,...data};return current;});
 m.transaction.mockImplementation(callback=>callback({invitacionEmpresa:{findUnique:m.invitation,update:m.inviteUpdate},usuario:{findUnique:m.user,findUniqueOrThrow:m.fresh,update:m.userUpdate},autorizacionEmpresa:{findUnique:m.grantFind,create:m.grantCreate,update:m.grantUpdate}}));
});
async function call(body:Record<string,unknown>={},handler=acceptInvitation){
 return new Promise<{data?:any;error?:any}>(resolve=>{
  const res={status:()=>res,json:(result:any)=>{resolve({data:result.data});}};
  handler({params:{token:'a'.repeat(64)},body:{email:member.email,password:'test-password',...body}} as never,res as never,(error:any)=>resolve({error}));
 });
}
function expectNoWrite(){expect(m.grantCreate).not.toHaveBeenCalled();expect(m.grantUpdate).not.toHaveBeenCalled();expect(m.inviteUpdate).not.toHaveBeenCalled();expect(m.userUpdate).not.toHaveBeenCalled();expect(m.event).not.toHaveBeenCalled();}
it('checks an unaccepted invitation without authorizing or consuming it',async()=>{
 expect((await call({soloConsultar:true})).data).toEqual({aceptada:false});expectNoWrite();
});
it('recovers the committed acceptance without a second grant or notice',async()=>{
 expect((await call()).data).toMatchObject({aceptada:true});expect(m.grantCreate).toHaveBeenCalledTimes(1);expect(m.event).toHaveBeenCalledTimes(2);
 vi.clearAllMocks();expect((await call({soloConsultar:true})).data).toEqual({aceptada:true,recuperada:true});expectNoWrite();
});
it('repeated acceptance after a lost response returns its result without replaying authorization',async()=>{
 current={...pending,aceptadaAt:new Date(),aceptadaPor:member.id};
 expect((await call()).data).toEqual({aceptada:true,recuperada:true});expectNoWrite();
});
it('can confirm historical acceptance after expiry without restoring a subsequently revoked grant',async()=>{
 current={...pending,aceptadaAt:new Date(Date.now()-2000),aceptadaPor:member.id,venceAt:new Date(Date.now()-1000)};m.grantFind.mockResolvedValue({id:'grant',activa:false,revision:4});
 expect((await call({soloConsultar:true})).data).toEqual({aceptada:true,recuperada:true});expectNoWrite();expect(m.grantFind).not.toHaveBeenCalled();
});
it.each(['wrong-password','wrong-email','different-recipient','suspended','unverified','changed-password','revoked'])('denies recovery for %s without writes',async reason=>{
 current={...pending,aceptadaAt:new Date(),aceptadaPor:member.id};
 if(reason==='wrong-password')m.compare.mockResolvedValue(false);
 if(reason==='different-recipient')current.aceptadaPor='another';
 if(reason==='suspended')m.user.mockResolvedValue({...member,motivoInactividad:'SUSPENDIDA'});
 if(reason==='unverified')m.user.mockResolvedValue({...member,emailVerified:false});
 if(reason==='changed-password')m.fresh.mockResolvedValue({...member,password:'changed'});
 if(reason==='revoked')current.revocadaAt=new Date();
 expect((await call({soloConsultar:true,...(reason==='wrong-email'?{email:'other@qa.invalid'}:{})})).error).toBeTruthy();expectNoWrite();
});
it('rejects expiry before acceptance, including a check-only request',async()=>{
 current={...pending,venceAt:new Date(Date.now()-1000)};expect((await call({soloConsultar:true})).error).toMatchObject({statusCode:404});expectNoWrite();
});
it('does not disclose an accepted invitation through the anonymous GET',async()=>{
 current={...pending,aceptadaAt:new Date(),aceptadaPor:member.id};expect((await call({},getInvitation)).error).toMatchObject({statusCode:404});expectNoWrite();
});
