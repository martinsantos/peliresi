import { expect, it } from 'vitest';
import { ROLE_GUIDANCE, presentationRole } from '../../utils/roleGuidance';
import { contextualGuidance } from '../../utils/contextualGuidance';
it('covers administrative roles, chief and inspector without actor instructions for auditor',()=>{
 expect(Object.keys(ROLE_GUIDANCE)).toHaveLength(10);
 expect(presentationRole('GENERADOR',true)).toBe('INSPECTOR');expect(presentationRole('ADMIN',true)).toBe('ADMIN');
 expect(ROLE_GUIDANCE.AUDITOR[0].desc).toContain('no crea');
 expect(ROLE_GUIDANCE.OPERADOR.map(s=>s.desc).join(' ')).toContain('no emite la final');
 expect(ROLE_GUIDANCE.TRANSPORTISTA.map(s=>s.desc).join(' ')).toContain('no se garantiza con la app cerrada');
});
it.each(['','/app','/mobile'])('contextual guidance on %s',prefix=>{
 expect(contextualGuidance(prefix+'/manifiestos/m/adendas','OPERADOR').manual).toBe('adendas-hallazgos-partes');
 expect(contextualGuidance(prefix+'/manifiestos/nuevo','OPERADOR').title).toBe('Completar la propuesta');
 expect(contextualGuidance(prefix+'/manifiestos/m','OPERADOR').title).toBe('Recepción y certificación');
 expect(contextualGuidance(prefix+'/manifiestos/m','TRANSPORTISTA').title).toBe('Continuar este viaje');
 expect(contextualGuidance(prefix+'/mis-inspecciones/i','GENERADOR').manual).toBe('actor-mis-inspecciones');
 expect(contextualGuidance(prefix+'/inspecciones/i','GENERADOR',true).manual).toBe('psip-flujo-inspecciones');
});
it.each(['', '/app', '/mobile'].flatMap(prefix => ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].map(role => [prefix, role])))('administrative admission guidance %s for %s follows the review task', (prefix, role) => {
 for (const route of ['/admin/solicitudes', '/admin/solicitudes/qa', '/admin/renovaciones']) {
  const help = contextualGuidance(prefix + route, role);
  expect(help.manual).toBe('revision-altas-renovaciones');
  expect(help.steps.join(' ')).toContain('Administración');
  expect(help.steps.join(' ')).not.toContain('Presentar');
  expect(help.steps.join(' ')).not.toContain('Adjuntá comprobantes');
 }
 expect(contextualGuidance(prefix + '/admin/solicitudes/qa', role).steps.join(' ')).toContain('Iniciar revisión');
 expect(contextualGuidance(prefix + '/admin/renovaciones', role).steps.join(' ')).toContain('propuestos');
});
it.each(['', '/app', '/mobile'])('requester help stays scoped to the actual task on %s', prefix => {
 for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
  const own = contextualGuidance(prefix + '/mi-solicitud', role);
  expect(own.manual).toBe('alta-responder-observaciones');
  expect(own.steps.join(' ')).toContain('sin reenviar');
  expect(own.steps.join(' ')).not.toContain('Iniciar revisión');
 }
 const changes = contextualGuidance(prefix + '/mi-perfil/solicitar-cambios', 'GENERADOR');
 expect(changes.title).toBe('Solicitar cambios de tu ficha');
 expect(changes.steps.join(' ')).toContain('Administración');
 expect(changes.steps.join(' ')).toContain('por cuenta y actividad');
 expect(changes.steps.join(' ')).toContain('sin duplicarla');
 expect(changes.steps.join(' ')).not.toContain('Adjuntá');
});

it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'])('chief guidance requires explicit assignment for %s', role => {
 expect(presentationRole(role, false, true)).toBe('ADMIN_INSPECCIONES');
 expect(presentationRole(role, true, true)).toBe('ADMIN_INSPECCIONES');
 expect(presentationRole(role, false, false)).toBe(role);
 expect(ROLE_GUIDANCE.ADMIN_INSPECCIONES[0].desc).toContain('no acreditan una infracción');
});

it.each(['', '/app', '/mobile'])('chief help distinguishes organizing inspections from responding as actor on %s', prefix => {
 const help=contextualGuidance(prefix+'/inspecciones','GENERADOR',false,true);
 expect(help.title).toBe('Organizar y seguir inspecciones');
 expect(help.manual).toBe('psip-flujo-inspecciones');
 expect(help.steps.join(' ')).toContain('Elegí inspector y fecha');
 expect(contextualGuidance(prefix+'/requerimientos/qa','GENERADOR',false,true).title).toBe('Responder el requerimiento');
 expect(contextualGuidance(prefix+'/inspecciones','GENERADOR',false,false).title).toBe('Responder el requerimiento');
});
