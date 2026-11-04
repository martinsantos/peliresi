import {beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),access:vi.fn(),previous:vi.fn(),reserve:vi.fn(),current:vi.fn(),create:vi.fn(),prepare:vi.fn(),tx:vi.fn()}));
vi.mock('../../lib/prisma',()=>({default:{inspeccion:{findUnique:m.read},$transaction:m.tx}}));
vi.mock('../../controllers/inspeccion.controller',()=>({canAccessInspection:m.access,inspectionInclude:{}}));
vi.mock('../../domain/manifiestoSignature',()=>({prepareManifiestoSignature:m.prepare}));
vi.mock('../../services/inspectionFieldActPdf.service',()=>({streamInspectionActPdf:vi.fn()}));
vi.mock('../../services/inspectionEvidence.service',()=>({resolveInspectionEvidence:vi.fn()}));
import {signInspectionAct} from '../../controllers/inspectionSignature.controller';
import {inspectionSignatureHash} from '../../domain/inspectionSignature';
const inspection={id:'case',numero:'QA',numeroActa:'QA-1',version:2,estado:'EN_CAMPO',inspectorId:'staff',ubicacion:'Práctica',observaciones:'Observación de práctica',datosActa:{},items:[],comparaciones:[],evidencias:[]};
function body(){return{version:2,contenidoSha256:inspectionSignatureHash(inspection),clienteId:'123e4567-e89b-42d3-a456-426614174000',nombre:'Persona QA',documento:'QA-000',caracter:'Responsable',tipo:'INSPECCIONADO',imagen:'data:image/png;base64,AAAA',lecturaConfirmada:true};}
function res(){return{status:vi.fn().mockReturnThis(),json:vi.fn()} as any;}
async function invoke(input=body()){const next=vi.fn(),response=res();await signInspectionAct({params:{id:'case'},user:{id:'staff',rol:'ADMIN'},body:input} as any,response,next);return{next,response};}
beforeEach(()=>{vi.resetAllMocks();m.read.mockResolvedValue(inspection);m.access.mockReturnValue(true);m.prepare.mockResolvedValue({imagen:'PNG',sha256:'image-hash'});m.previous.mockResolvedValue(null);m.reserve.mockResolvedValue({count:1});m.current.mockResolvedValue({...inspection,version:3});m.create.mockResolvedValue({id:'signature'});m.tx.mockImplementation(fn=>fn({eventoInspeccion:{findFirst:m.previous,create:m.create},inspeccion:{updateMany:m.reserve,findUniqueOrThrow:m.current}}));});
describe('field signature transaction',()=>{
 it('records the inspected person signature in the existing administrative formality without losing field data',async()=>{m.read.mockResolvedValue({...inspection,datosActa:{modeloCampo:2,atendidoPor:'Persona QA'}}); await invoke();expect(m.reserve.mock.calls[0][0].data.datosActa).toMatchObject({modeloCampo:2,atendidoPor:'Persona QA',firmaIntervinienteEstado:'FIRMADA'});});
 it('does not substitute the inspector signature for the inspected person',async()=>{await invoke({...body(),tipo:'INSPECTOR'});expect(m.reserve.mock.calls[0][0].data).not.toHaveProperty('datosActa');});

 it('denies unassigned actors before signature storage',async()=>{m.access.mockReturnValue(false);const{next}=await invoke();expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(m.tx).not.toHaveBeenCalled();});
 it('requires affirmative review',async()=>{const{next}=await invoke({...body(),lecturaConfirmada:false});expect(next).toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();});
 it('rejects a stale version',async()=>{m.reserve.mockResolvedValue({count:0});const{next}=await invoke();expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));expect(m.create).not.toHaveBeenCalled();});
 it('rejects changed content despite a supplied current version',async()=>{m.current.mockResolvedValue({...inspection,version:3,observaciones:'Cambió el acta'});const{next}=await invoke();expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));expect(m.create).not.toHaveBeenCalled();});
 it('rechecks assignment inside transaction',async()=>{m.access.mockReturnValueOnce(true).mockReturnValue(false);const{next}=await invoke();expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(m.create).not.toHaveBeenCalled();});
 it('stores frozen content and signer with conditional version reservation',async()=>{const{next,response}=await invoke();expect(next).not.toHaveBeenCalled();expect(response.status).toHaveBeenCalledWith(201);expect(m.reserve).toHaveBeenCalledWith(expect.objectContaining({where:{id:'case',version:2,estado:{in:['BORRADOR','PLANIFICADA','EN_CAMPO']}}}));const meta=m.create.mock.calls[0][0].data.metadata;expect(meta.snapshot.observaciones).toBe(inspection.observaciones);expect(meta.firma.capturadaPor).toBe('staff');expect(meta.snapshot).not.toHaveProperty('informeTecnico');});
 it('reuses exact retry without reserving a second version',async()=>{const b=body();m.previous.mockResolvedValue({id:'signed',usuarioId:'staff',metadata:{contenidoSha256:b.contenidoSha256,version:3,firma:{sha256:'image-hash',nombre:b.nombre,documento:b.documento,caracter:b.caracter,tipo:b.tipo}}});const{next,response}=await invoke();expect(next).not.toHaveBeenCalled();expect(response.json.mock.calls[0][0].data.id).toBe('signed');expect(m.reserve).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();});
 it('refuses reuse of command id for another signer',async()=>{m.previous.mockResolvedValue({id:'signed',usuarioId:'someone-else',metadata:{}});const{next}=await invoke();expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));expect(m.create).not.toHaveBeenCalled();});
});
