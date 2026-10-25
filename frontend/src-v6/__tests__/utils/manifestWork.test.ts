import { describe, expect, it } from 'vitest';
import { manifestWork, rejectionReason } from '../../utils/manifestWork';

const roles = ['GENERADOR','TRANSPORTISTA','OPERADOR'];
const approved = roles.map(rol=>({rol,aprobada:true}));
describe('shared operational guidance never replaces server authorization',()=>{
  it.each(roles)('names every pending party for %s',role=>{
    const next=manifestWork({estado:'PENDIENTE_APROBACION',partes:approved.map(p=>({...p,aprobada:p.rol!==role})),requiereMiAprobacion:true},role);
    expect(next.label).toBe('Te toca aprobar');expect(next.tone).toBe('pending');expect(next.responsible).toBe({GENERADOR:'Generador',TRANSPORTISTA:'Transporte',OPERADOR:'Operador'}[role]);
  });
  it.each([[[]],[approved.map(p=>({...p,aprobada:p.rol!=='OPERADOR'}))]])('does not infer unanimity from APROBADO: %j',partes=>{
    expect(manifestWork({estado:'APROBADO',partes},'ADMIN')).toMatchObject({label:'Revisar aprobaciones',tone:'blocked'});
  });
  it('distinguishes coordination from physical pickup',()=>{
    expect(manifestWork({estado:'APROBADO',partes:approved},'TRANSPORTISTA').label).toBe('Listo para iniciar');
    expect(manifestWork({estado:'APROBADO',partes:approved,inicio:'2026-10-25'},'TRANSPORTISTA')).toMatchObject({label:'Confirmar retiro',responsible:'Transporte'});
  });
  it('keeps in-situ responsibility without inventing transport',()=>{
    expect(manifestWork({estado:'APROBADO',modalidad:'IN_SITU',inicio:'2026-10-25',partes:approved.filter(p=>p.rol!=='TRANSPORTISTA')},'OPERADOR')).toMatchObject({label:'Confirmar recepción en origen',responsible:'Operador'});
  });
  it.each(['ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO'])('assigns post-delivery work to operator, even for other viewers: %s',estado=>{
    for(const role of [...roles,'ADMIN'])expect(manifestWork({estado},role).responsible).toBe('Operador');
  });
  it('does not equate treatment closure to certificate emission',()=>{
    expect(manifestWork({estado:'TRATADO'},'GENERADOR').label).toBe('Esperando certificado final');
    expect(manifestWork({estado:'TRATADO',finalEmitido:true},'GENERADOR').tone).toBe('done');
  });
  it('does not advertise an action for a rejected or unknown record',()=>{
    expect(manifestWork({estado:'APROBADO',partes:approved,rechazo:'no'},'OPERADOR').tone).toBe('blocked');
    expect(manifestWork({estado:'FUTURO'},'OPERADOR').label).toBe('Estado por verificar');
  });
  it('handles historical rejection descriptions without crashing the detail',()=>{
    expect(rejectionReason('{"motivo":"Sin capacidad"}')).toBe('Sin capacidad');
    expect(rejectionReason('Texto anterior')).toBe('Texto anterior');
    expect(rejectionReason('{incorrecto')).toBe('{incorrecto');
    expect(rejectionReason('null')).toBe('null');
  });
});
