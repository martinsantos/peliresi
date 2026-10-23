import { expect, it } from 'vitest';
import { ROLE_GUIDANCE, presentationRole } from '../../utils/roleGuidance';
import { contextualGuidance } from '../../utils/contextualGuidance';
it('covers eight roles and inspector without actor instructions for auditor',()=>{
 expect(Object.keys(ROLE_GUIDANCE)).toHaveLength(9);
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