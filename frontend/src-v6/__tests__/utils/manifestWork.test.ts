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
    expect(manifestWork({estado:'APROBADO',modalidad:'IN_SITU',inicio:'2026-10-25',partes:approved.filter(p=>p.rol!=='TRANSPORTISTA')},'OPERADOR')).toMatchObject({label:'Revisar aprobaciones',responsible:'Transporte',tone:'blocked'});
  });
  it.each(['ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO'])('assigns post-delivery work to operator, even for other viewers: %s',estado=>{
    for(const role of [...roles,'ADMIN'])expect(manifestWork({estado},role).responsible).toBe('Operador');
  });
  it.each([
    ['ENTREGADO', false, 'Comprobá la carga'],
    ['RECIBIDO', true, 'Registrá las cantidades'],
    ['RECIBIDO', false, 'Registrá el tratamiento'],
    ['EN_TRATAMIENTO', false, 'Podés emitir parciales'],
  ])('gives the operator actionable guidance for %s', (estado,pesajePendiente,expected) => {
    expect(manifestWork({estado,pesajePendiente},'OPERADOR').detail).toContain(expected);
  });
  it.each([
    ['ENTREGADO', false],
    ['RECIBIDO', true],
    ['RECIBIDO', false],
    ['EN_TRATAMIENTO', false],
  ])('explains the operator’s work to other roles in %s', (estado,pesajePendiente) => {
    for (const role of ['GENERADOR','TRANSPORTISTA','ADMIN']) {
      const detail = manifestWork({estado,pesajePendiente},role).detail;
      expect(detail).toMatch(/El operador/i);
      expect(detail).not.toMatch(/Comprobá|Registrá|Podés emitir|Cerrá/);
    }
  });
  it.each(['OPERADOR', 'GENERADOR', 'TRANSPORTISTA', 'ADMIN'])('does not infer weighing or treatment when weighing data is missing for %s', role => {
    expect(manifestWork({estado:'RECIBIDO'},role)).toMatchObject({label:'Pesaje por comprobar',responsible:'Operador',tone:'blocked'});
    expect(manifestWork({estado:'RECIBIDO'},role).detail).toContain('Actualizá el manifiesto');
  });
  it('does not infer treatment from an empty waste list flagged by the agenda', () => {
    expect(manifestWork({estado:'RECIBIDO',pesajePendiente:false,pesajeNoDisponible:true},'OPERADOR')).toMatchObject({label:'Pesaje por comprobar',tone:'blocked'});
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
