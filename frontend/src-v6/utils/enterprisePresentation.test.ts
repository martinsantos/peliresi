import { expect,it } from 'vitest';
import { companyGeneratorView } from './enterprisePresentation';
const actor={id:'g',razonSocial:'Ficha',domicilio:'Dirección anterior',latitud:-32,longitud:-68};
const context:any={rol:'GENERADOR',razonSocial:'Empresa al declarar',domicilioLegal:{calle:'Legal'},establecimiento:{nombre:'Planta Norte',domicilio:'Productiva'}};
it('keeps legal/productive addresses separate without inheriting coordinates from a different legacy site',()=>{
 expect(companyGeneratorView(actor,context)).toMatchObject({domicilio:'Productiva',domicilioLegalEmpresa:'Legal',latitud:null,longitud:null,establecimientoEmpresa:'Planta Norte'});
 expect(actor.domicilio).toBe('Dirección anterior');
 expect(companyGeneratorView(actor,{...context,establecimiento:{...context.establecimiento,latitud:0,longitud:0}})).toMatchObject({latitud:0,longitud:0});
});
it('leaves historical unscoped actor data unchanged and never guesses a missing productive site',()=>{
 expect(companyGeneratorView(actor)).toBe(actor);
 expect(companyGeneratorView(actor,{...context,establecimiento:undefined})).toMatchObject({domicilio:'',latitud:null,longitud:null});
});
