import { describe, expect, it } from 'vitest';
import { canonicalLink, linkDestination, publicLink } from '../../utils/linkPreference';
import { safeLocalRedirect } from '../../utils/authRedirect';
describe('personal link destination', () => {
 it.each(['//other.invalid','/app//other.invalid','/%2foutside','/app/abrir?destino=/abrir','https://other.invalid',null])('rejects unsafe or recursive %s', value => expect(canonicalLink(value)).toBeNull());
 it.each(['WEB','APP','AUTO'] as const)('preserves object/query/anchor %s', p => expect(linkDestination('/app/manifiestos/m?certificado=c#certificaciones',p,false,false)).toBe((p==='APP'?'/app':'')+'/manifiestos/m?certificado=c#certificaciones'));
 it('honors explicit choice over phone and installed context',()=>{
  expect(linkDestination('/notificaciones/n','WEB',true,true)).toBe('/notificaciones/n');
  expect(linkDestination('/notificaciones/n','APP',false,false)).toBe('/app/notificaciones/n');
  expect(linkDestination('/notificaciones/n','AUTO',true,false)).toBe('/app/notificaciones/n');
 });
 it('maps the inspected actor without losing the dossier',()=>expect(linkDestination('/inspecciones/i#intercambios','APP',false,false,'GENERADOR')).toBe('/app/requerimientos/i#intercambios'));
 it('resumes the resolver after login and preserves public auth tokens',()=>{
  expect(safeLocalRedirect('/abrir?destino=%2Fmanifiestos%2Fm')).toBe('/abrir?destino=%2Fmanifiestos%2Fm');
  expect(canonicalLink('/verificar-email?token=a%2Fb%2Bc')).toBe('/verificar-email?token=a%2Fb%2Bc');
  expect(publicLink('/reset-password?token=secret')).toBe(true);expect(publicLink('/mi-solicitud')).toBe(false);
 });
});