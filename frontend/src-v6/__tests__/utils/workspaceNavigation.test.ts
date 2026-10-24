import { inspectionContextLabel } from '../../utils/inspectionContextLabel';
import {describe,it,expect} from 'vitest';
import type {User,UserRole} from '../../contexts/AuthContext';
import {workspaceNavigation,workspaceTitle,ADMIN_ROLES} from '../../utils/workspaceNavigation';
import {canAccessMobilePath} from '../../utils/mobileAccess';
import {postLoginDestination} from '../../utils/authRedirect';
const user=(rol:UserRole,esInspector=false)=>({id:'qa',rol,esInspector,actorId:'own'} as User);
describe('Shared web/app workspace contract',()=>{
 it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'] as UserRole[])('%s has work, notices and own profile, without an inspection directory',rol=>{
  const u=user(rol), paths=workspaceNavigation(u).map(i=>i.path);
  expect(paths).toEqual(expect.arrayContaining(['/dashboard','/manifiestos','/notificaciones']));
  expect(paths).not.toEqual(expect.arrayContaining(['/mis-inspecciones']));
  expect(paths).not.toContain('/inspecciones');
  expect(paths).not.toContain('/alertas');
  for(const prefix of ['','/mobile','/app']){
   expect(canAccessMobilePath(u,prefix+'/mis-inspecciones')).toBe(false);
   expect(canAccessMobilePath(u,prefix+'/inspecciones/other')).toBe(false);
   expect(canAccessMobilePath(u,prefix+'/requerimientos/notified-case')).toBe(true);
  }
  expect(paths.includes('/transporte/perfil')).toBe(rol==='TRANSPORTISTA');
 });
 it.each(ADMIN_ROLES as UserRole[])('%s keeps inspection management and only its administrative desks',rol=>{
  const u=user(rol),nav=workspaceNavigation(u);
  expect(nav.map(i=>i.path)).toContain('/inspecciones');
  expect(nav.map(i=>i.path)).toContain('/admin/solicitudes');
  expect(nav.every(i=>canAccessMobilePath(u,i.path))).toBe(true);
  expect(new Set(nav.map(i=>i.path)).size).toBe(nav.length);
  if(rol!=='ADMIN')expect(nav.map(i=>i.path)).not.toContain('/admin/usuarios');
 });
 it('does not promote an auditor to an administrator',()=>{
  const paths=workspaceNavigation(user('AUDITOR')).map(i=>i.path);
  expect(paths).not.toContain('/inspecciones');expect(paths.some(p=>p.startsWith('/admin/'))).toBe(false);
 });
 it('preserves explicit inspector designation without granting administrative ABM',()=>{
  const u=user('GENERADOR',true),paths=workspaceNavigation(u).map(i=>i.path);
  expect(paths).toContain('/inspecciones');expect(paths).toContain('/actores');
  expect(paths).not.toContain('/admin/actores');expect(paths).not.toContain('/admin/usuarios');
 });
 it.each(['','/mobile','/app'])('uses consistent titles on %s',prefix=>{
  expect(workspaceTitle(prefix+'/empresas')).toBe('Empresas y establecimientos');
  expect(workspaceTitle(prefix+'/manifiestos/abc')).toBe('Manifiestos');
  expect(workspaceTitle(prefix+'/requerimientos/abc')).toBe('Requerimiento');
  expect(workspaceTitle(prefix+'/notificaciones')).toBe('Avisos');
 });
 it('recovers old mail links and avoids login into an inaccessible inspection directory',()=>{
  expect(postLoginDestination('/inspecciones','OPERADOR')).toBe('/dashboard');
  expect(postLoginDestination('/mis-inspecciones?estado=NOTIFICADA','GENERADOR')).toBe('/dashboard');
  expect(postLoginDestination('/inspecciones/abc#intercambios','GENERADOR')).toBe('/requerimientos/abc#intercambios');
  expect(postLoginDestination('/mobile/mis-inspecciones/abc','TRANSPORTISTA')).toBe('/mobile/requerimientos/abc');
  expect(postLoginDestination('/inspecciones/abc','GENERADOR',true)).toBe('/inspecciones/abc');
 });
});


it('keeps the administrator identity at home and the inspection function inside its workspace',()=>{
  expect(inspectionContextLabel({rol:'ADMIN',esInspector:true},'/app/dashboard')).toBeNull();
  expect(inspectionContextLabel({rol:'ADMIN',esInspector:true},'/app/inspecciones/qa')).toBe('Inspector');
  expect(inspectionContextLabel({rol:'GENERADOR',esInspector:true},'/app/dashboard')).toBe('Inspector');
});
