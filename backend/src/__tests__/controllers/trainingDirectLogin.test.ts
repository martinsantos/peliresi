import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { inTrainingSession, isTrainingSession, TRAINING_REALM } from '../../lib/trainingScope';
const db = vi.hoisted(() => ({ usuario: { findUnique: vi.fn(), findFirst: vi.fn() }, auditoria: { create: vi.fn() } }));
const compare = vi.hoisted(() => vi.fn());
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('bcryptjs', () => ({ default: { compare } }));
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'qa-direct-school-only', JWT_EXPIRES_IN: '30m' } }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../services/actorActivities.service', () => ({ accountActivities: vi.fn().mockResolvedValue([]) }));
vi.mock('../../services/empresa.service', () => ({ companyContexts: vi.fn().mockResolvedValue([]), resolveCompanyContext: vi.fn() }));
import { login, refreshToken } from '../../controllers/auth.controller';
import { isAuthenticated } from '../../middlewares/auth.middleware';
import { trainingSession } from '../../middlewares/trainingSession';
import { TRAINING_LOGINS, generateDirectTrainingTokens } from '../../lib/trainingDirectLogin';
const res = () => ({ json: vi.fn(), setHeader: vi.fn() });
const account = TRAINING_LOGINS[0];
const schoolUser = (a = account) => ({ id:a.id, email:a.id+'@capacitacion.invalid', rol:a.rol, nombre:'CAP', activo:true, emailVerified:true, password:'hashed', generador:null, transportista:null, operador:null });
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
  vi.stubEnv('TRAINING_DATABASE_URL', 'postgresql://school@localhost/test?schema=sitrep_training');
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL', '2026-10-20T03:00:00Z');
  db.usuario.findUnique.mockImplementation(async () => { expect(isTrainingSession()).toBe(true); return schoolUser(); });
  db.auditoria.create.mockImplementation(async () => { expect(isTrainingSession()).toBe(true); return {}; });
  compare.mockResolvedValue(true);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it.each(TRAINING_LOGINS)('logs in $rol only in school with a signed direct realm and no instructor', async a => {
  db.usuario.findUnique.mockImplementation(async () => { expect(isTrainingSession()).toBe(true); return schoolUser(a); });
  const response=res(),next=vi.fn();
  await login({body:{email:a.email,password:'classroom-test'}} as never,response as never,next);
  expect(next).not.toHaveBeenCalled(); expect(db.usuario.findFirst).not.toHaveBeenCalled();
  const data=response.json.mock.calls[0][0].data;
  expect(data.user).toMatchObject({id:a.id,rol:a.rol,training:true});expect(data.user.password).toBeUndefined();
  for(const token of Object.values(data.tokens)) {
    const claims=jwt.verify(token as string,'qa-direct-school-only') as jwt.JwtPayload;
    expect(claims).toMatchObject({id:a.id,realm:TRAINING_REALM,trainingDirect:true});expect(claims.impersonatedBy).toBeUndefined();
    expect(claims.exp).toBeLessThanOrEqual(Date.parse('2026-10-20T03:00:00Z')/1000);
  }
  expect(isTrainingSession()).toBe(false);
});
it.each(['missing@capacitacion.invalid','cap-20261012-admin-2@capacitacion.invalid'])('rejects unlisted alias %s without consulting public',async email=>{
  const response=res(),next=vi.fn();await login({body:{email,password:'wrong'}} as never,response as never,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(db.usuario.findFirst).not.toHaveBeenCalled();expect(db.usuario.findUnique).not.toHaveBeenCalled();
});
it.each(['wrong-password','inactive','unverified','wrong-role','wrong-email','audit-failed'])('fails closed for %s',async reason=>{
  const user=schoolUser();
  if(reason==='wrong-password')compare.mockResolvedValue(false);
  if(reason==='inactive')user.activo=false;if(reason==='unverified')user.emailVerified=false;
  if(reason==='wrong-role')user.rol='GENERADOR' as never;if(reason==='wrong-email')user.email='real@example.org';
  db.usuario.findUnique.mockResolvedValue(user);if(reason==='audit-failed')db.auditoria.create.mockRejectedValue(new Error('audit down'));
  const response=res(),next=vi.fn();await login({body:{email:account.email,password:'wrong'}} as never,response as never,next);
  expect(next).toHaveBeenCalled();expect(response.json).not.toHaveBeenCalled();expect(db.usuario.findFirst).not.toHaveBeenCalled();
});
it.each(['','invalid','2026-10-19T11:00:00Z'])('denies disabled/expired classroom before DB access: %s',async deadline=>{
  vi.stubEnv('TRAINING_DIRECT_LOGIN_UNTIL',deadline);const next=vi.fn();await login({body:{email:account.email,password:'classroom'}} as never,res() as never,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(db.usuario.findUnique).not.toHaveBeenCalled();expect(db.usuario.findFirst).not.toHaveBeenCalled();
});
it('renews without dropping the school scope or querying an operational administrator',async()=>{
  const token=inTrainingSession(()=>generateDirectTrainingTokens(account.id)).refreshToken;
  const request={path:'/api/auth/refresh-token',method:'POST',headers:{},body:{refreshToken:token}}, response=res(), next=vi.fn();
  await new Promise<void>((resolve,reject)=>trainingSession(request as never,response as never,(error?:unknown)=>{
    if(error)return reject(error);refreshToken(request as never,response as never,next).then(resolve,reject);
  }));
  expect(next).not.toHaveBeenCalled();const claims=jwt.verify(response.json.mock.calls[0][0].data.accessToken,'qa-direct-school-only');
  expect(claims).toMatchObject({realm:TRAINING_REALM,trainingDirect:true,id:account.id});expect(db.usuario.findUnique).toHaveBeenCalledTimes(1);
});
it('profile authentication stays school-scoped, and disabling a CAP account revokes it',async()=>{
  const token=inTrainingSession(()=>generateDirectTrainingTokens(account.id)).accessToken;
  for(const active of [true,false]){
    db.usuario.findUnique.mockResolvedValue({...schoolUser(),activo:active});const next=vi.fn();
    const request={path:'/api/auth/profile',originalUrl:'/api/auth/profile',method:'GET',headers:{authorization:'Bearer '+token}};
    await new Promise<void>((resolve,reject)=>trainingSession(request as never,res() as never,(error?:unknown)=>{
      if(error)return reject(error);isAuthenticated(request as never,res() as never,next).then(resolve,reject);
    }));
    if(active)expect(next).toHaveBeenCalledWith();else expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));
  }
});
it('ordinary login keeps the operational query path',async()=>{
  db.usuario.findFirst.mockResolvedValue(null);const next=vi.fn();await login({body:{email:'ordinary@example.org',password:'wrong'}} as never,res() as never,next);
  expect(db.usuario.findFirst).toHaveBeenCalled();expect(db.usuario.findUnique).not.toHaveBeenCalled();expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));
});

it('never queries public if a direct refresh reaches a controller without school routing',async()=>{
  const token=inTrainingSession(()=>generateDirectTrainingTokens(account.id)).refreshToken;
  const next=vi.fn();await refreshToken({body:{refreshToken:token}} as never,res() as never,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(db.usuario.findUnique).not.toHaveBeenCalled();
});
it('never queries public if a direct bearer reaches authentication without school routing',async()=>{
  const token=inTrainingSession(()=>generateDirectTrainingTokens(account.id)).accessToken;
  const next=vi.fn();await isAuthenticated({headers:{authorization:'Bearer '+token}} as never,res() as never,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:401}));expect(db.usuario.findUnique).not.toHaveBeenCalled();
});
