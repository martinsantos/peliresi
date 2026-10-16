import { expect,it } from 'vitest';
import { createEmpresa,createEstablecimiento,personSchema,canReadEnterpriseManifest,authorizationScope,companyListQuery, type EnterpriseContext } from '../domain/empresa';
import { applyRoleFilter,canAccessManifiesto } from '../utils/roleFilter';
import { planCompanyRegister,type PadronRow,type RegisterSnapshot } from '../domain/padronEmpresaPlan';
it('company pagination validates bounds without silently coercing malformed or repeated query parameters',()=>{
 expect(companyListQuery.parse({})).toEqual({page:1,limit:25,search:''});
 expect(companyListQuery.parse({page:'9',limit:'100',search:'  30-71234567-1  '})).toEqual({page:9,limit:100,search:'30-71234567-1'});
 for(const query of [{page:'0'},{page:'-1'},{page:'1.5'},{page:'1000001'},{page:['1','2']},{limit:'101'},{search:'a'.repeat(101)},{unknown:'x'}])expect(companyListQuery.safeParse(query).success).toBe(false);
});
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
it('invitation acceptance projects grant scope without copying invitation identity or credentials into authorization',()=>{
 const input={id:'invitation',email:'qa@invalid',tokenHash:'secret-hash',creadaPor:'issuer',actividadId:'a',todosEstablecimientos:false,establecimientoIds:['s']};
 expect(authorizationScope(input)).toEqual({actividadId:'a',todosEstablecimientos:false,establecimientoIds:['s']});
 expect(authorizationScope(input).establecimientoIds).not.toBe(input.establecimientoIds);
});
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
const snapshot=():RegisterSnapshot=>({readOnly:'on',capturedAt:'2026-10-16T18:08:59Z',generators:[{id:'existing',cuit:'30-71234567-1',numeroInscripcion:'G-000001',activo:true,rubro:'Anterior'}],operators:[{id:'op-existing',cuit:'30712345671',activo:false}],transports:[]});
it('snapshot reconciliation reuses exact actor identity without overwrites, preserves differences and marks inactive roles for review',()=>{
 const a=row(2);a.reconciliation.proposedDifferences=[{field:'rubro',existing:'Anterior',source:'Nuevo',action:'REVISAR'}];
 const original=structuredClone(a),db=snapshot(),before=structuredClone(db),plan=planCompanyRegister([a],[],db);
 expect(plan.summary).toMatchObject({matchedExistingRows:1,pending:0,fieldDifferencesToReview:1,automaticWrites:0,automaticSiteCreations:0});
 expect(plan.reconciliation[0]).toMatchObject({actorId:'existing',destino:'CONSERVAR_FICHA_EXISTENTE',actualizarExistentes:false});
 expect(plan.companies[0].actividadesExistentesCandidatas).toHaveLength(2);
 expect(plan.companies[0].revisiones).toContain('ACTIVIDAD_INACTIVA_NO_HABILITAR');
 expect(plan.companies[0].establecimientos[0].crearAutomaticamente).toBe(false);
 expect(a).toEqual(original);expect(db).toEqual(before);
 expect(planCompanyRegister([a],plan.sources,db).summary).toMatchObject({newSources:0,replayed:1,matchedExistingRows:0,companies:0});
});
it('a different certificate never creates a duplicate role or invents an additional establishment',()=>{
 const a=row(2),b=row(3,'G-000002');b.reconciliation.status='ESTABLECIMIENTO_NO_REPRESENTADO';
 const plan=planCompanyRegister([a,b],[],snapshot());
 expect(plan.summary).toMatchObject({companies:1,matchedExistingRows:1,existingEntityOtherCertificate:1,pending:0});
 expect(plan.companies[0].fichasExistentes).toEqual(['existing']);
 expect(plan.companies[0].revisiones).toContain('DISTINGUIR_SEDES_DE_CERTIFICADOS_SUCESIVOS');
 expect(plan.companies[0].establecimientos.every((s:any)=>s.crearAutomaticamente===false)).toBe(true);
});
it.each(['certificate-other-cuit','ambiguous','stale-actor','stale-certificate','stale-difference','new-but-existing'] as const)('snapshot conflict %s remains pending with original observations and no first-match proposal',kind=>{
 const a=row(2),db=snapshot();
 if(kind==='certificate-other-cuit')db.generators[0].cuit='20123456786';
 if(kind==='ambiguous')db.generators.push({...db.generators[0],id:'duplicate'});
 if(kind==='stale-actor')a.reconciliation.actorId='gone';
 if(kind==='stale-certificate')db.generators[0].numeroInscripcion='G-000099';
 if(kind==='stale-difference')a.reconciliation.proposedDifferences=[{field:'rubro',existing:'Obsoleto',source:'Nuevo'}];
 if(kind==='new-but-existing')a.reconciliation.status='ENTIDAD_NUEVA_A_PREPARAR';
 const plan=planCompanyRegister([a],[],db);
 expect(plan.summary).toMatchObject({pending:1,companies:0,automaticWrites:0});expect(plan.pending[0].datos).toEqual(a);
 expect(plan.reconciliation[0].destino).toBe('PENDIENTE');
});
it('only a genuinely absent verified identity is proposed, with source evidence and no account or legal state inferred',()=>{
 const a=row(2);a.reconciliation={status:'ENTIDAD_NUEVA_A_PREPARAR'};
 const db={...snapshot(),generators:[],operators:[]};
 const plan=planCompanyRegister([a],[],db);
 expect(plan.summary).toMatchObject({newEntityRows:1,pending:0});expect(plan.companies[0].crearCuentas).toBe(false);
 expect(plan.sources[0].datos.sourceMarks.legalStatus).toBeNull();
 expect(()=>planCompanyRegister([a],[],{...db,readOnly:'off'} as any)).toThrow('sólo lectura');
});
