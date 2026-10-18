import type { CompanyContext } from '../services/companyContext';
/** Presentation only: never mutate catalogues or invent a productive location. */
export function companyGeneratorView<T extends Record<string,any>>(actor:T|undefined,context?:CompanyContext|null) {
 if(!actor||context?.rol!=='GENERADOR')return actor;
 const site=context.establecimiento;
 return {...actor,razonSocial:context.razonSocial,domicilio:site?.domicilio||'',latitud:site?.latitud??null,longitud:site?.longitud??null,
  domicilioLegalEmpresa:context.domicilioLegal.calle,establecimientoEmpresa:site?.nombre||'Sin establecimiento seleccionado'};
}
