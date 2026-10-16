import { expect,it } from 'vitest';
import { createEmpresa,createEstablecimiento,personSchema,canReadEnterpriseManifest, type EnterpriseContext } from '../domain/empresa';
import { applyRoleFilter,canAccessManifiesto } from '../utils/roleFilter';
import { planCompanyRegister,type PadronRow } from '../domain/padronEmpresaPlan';
it('company CUIT is verified, legal and productive addresses are distinct and no authority can be forged',()=>{
 const company={cuit:'30-71234567-1',razonSocial:'Sintética',domicilioLegal:{calle:'Legal',localidad:'',departamento:''}};
 expect(createEmpresa.safeParse(company).success).toBe(true);
 expect(createEmpresa.safeParse({...company,cuit:'30712345670'}).success).toBe(false);
 expect(createEmpresa.safeParse({...company,validadoPor:'fake'}).success).toBe(false);
 expect(createEstablecimiento.safeParse({codigo:'S1',nombre:'Sede',domicilio:'',certificados:[]}).success).toBe(true);
 expect(createEstablecimiento.safeParse({codigo:'S1',nombre:'Sede',domicilio:'Productiva',certificados:[],latitud:91,longitud:0}).success).toBe(false);
});
it('authorization requires an explicit scope, cannot reinterpret empty as all',()=>{
 const a={email:'member@qa.invalid',actividadId:'activity',todosEstablecimientos:false,establecimientoIds:[]};
 expect(personSchema.safeParse(a).success).toBe(false);
 expect(personSchema.safeParse({...a,establecimientoIds:['s1']}).success).toBe(true);
 expect(personSchema.safeParse({...a,todosEstablecimientos:true}).success).toBe(true);
 expect(personSchema.safeParse({...a,todosEstablecimientos:true,establecimientoIds:['s1']}).success).toBe(false);
});
it('site isolation is applied to list/search and detail, old unassigned records fail closed',()=>{
 const context={empresaId:'c1',establecimientoId:'s1',todasSedes:false} as EnterpriseContext;
 const user={rol:'GENERADOR',generador:{id:'g1'},empresaContexto:context};
 const where:any={OR:[{numero:{contains:'find'}}]};applyRoleFilter(where,user);
 expect(where.OR).toHaveLength(1);expect(where.AND).toHaveLength(2);expect(where.generadorId).toBe('g1');
 expect(canAccessManifiesto(user,{generadorId:'g1'})).toBe(false);
 expect(canAccessManifiesto(user,{generadorId:'g1',contextoEmpresa:{empresaId:'c1',establecimientoId:'s2'}})).toBe(false);
 expect(canAccessManifiesto(user,{generadorId:'g1',contextoEmpresa:{empresaId:'c1',establecimientoId:'s1'}})).toBe(true);
 expect(canReadEnterpriseManifest({...context,todasSedes:true},{})).toBe(true);
});
const row=(n:number,certificate='G-000001'):PadronRow=>({source:{file:'synthetic.xlsx',sha256:'a'.repeat(64),sheet:'REGISTRO',row:n},participant:{cuitNormalized:'30712345671',certificate,name:'Sintética'},addresses:{legal:['Legal','',''],productive:['Productiva','','']},fields:[{cell:'AD2',value:'observación sin presentar'}],sourceMarks:{legalStatus:null,colors:['FF0000']},reconciliation:{status:'COINCIDENCIA_CERTIFICADO_Y_CUIT',actorId:'existing'},apply:false});
it('register plan keeps several establishments per company, all raw observations and never proposes user creation or overwrite',()=>{
 const a=row(2),b=row(3,'G-000002');b.addresses.legal=['Otro domicilio','',''];
 const plan=planCompanyRegister([a,b]);
 expect(plan.summary).toMatchObject({companies:1,establishments:2,legalAddressConflicts:1,pending:0});
 expect(plan.companies[0]).toMatchObject({crearCuentas:false,modificarExistentes:false});
 expect(plan.sources[0].datos).toEqual(a);expect(plan.companies[0].establecimientos[0].estadoLegal).toBeNull();
 expect(planCompanyRegister([a,b],plan.sources).summary).toMatchObject({replayed:2,newSources:0,companies:0});
 expect(()=>planCompanyRegister([{...a,fields:['changed']}],plan.sources)).toThrow('contenido distinto');
});
it('doubtful identities, repeated certificates and ambiguous existing actors remain pending, no first match wins',()=>{
 const a=row(2),b=row(3),c=row(4,'G-000003'),d=row(5,'G-000004');c.participant.cuitNormalized='30712345670';d.reconciliation.status='COINCIDENCIA_AMBIGUA';
 const plan=planCompanyRegister([a,b,c,d]);expect(plan.summary).toMatchObject({pending:4,companies:0,newSources:4});
 expect(planCompanyRegister([a,a]).summary).toMatchObject({replayed:1,newSources:1,establishments:1});
 expect(()=>planCompanyRegister([{...a,apply:true} as any])).toThrow('Staging inválido');
});
