import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/inspectionManagementRole.service', () => ({ inspectionManagementRecipientIds: vi.fn(async () => []) }));
import { recordFindingIntakes } from '../../services/inspectionIntake.service';

const created: any[] = [];
const tx: any = {
  antecedenteFiscalizacion: { createMany: vi.fn(async ({ data }: any) => { created.push(...data); return { count: data.length }; }) },
  generador: { findUniqueOrThrow: vi.fn(async () => ({ razonSocial: 'Generador QA' })) },
  usuario: { findMany: vi.fn(async () => []) },
  notificacion: { createMany: vi.fn(async () => ({ count: 0 })) },
};
const informe = (diferencias: any[]) => ({ formato: 'SITREP-INFORME-HALLAZGO-1', autorId: 'op', fecha: '2026-11-07', estadoAlRegistrar: 'RECIBIDO', motivo: 'x',
  declarado: [], observado: [], diferencias,
  alcanceOperador: { fuente: 'operador.corrientesY', actorId: 'o1', nombre: 'Operador QA', valorOriginal: 'Y8', corrientes: ['Y8'], fichaActualizadaAt: '', numeroHabilitacion: null, resolucion: null, vencimiento: null, estado: 'FICHA_DISPONIBLE', corrientesNoRegistradas: [], advertencia: '' } }) as any;
const generatorIntake = () => created.find(row => row.tipoActor === 'GENERADOR');

beforeEach(() => { created.length = 0; vi.clearAllMocks(); });

describe('generator antecedent of a reception finding', () => {
  it('keeps the quantity-difference antecedent as before', async () => {
    await recordFindingIntakes(tx, { adendaId: 'a1', referencia: 'M-1', generadorId: 'g1', creadoPorId: 'op', informe: informe([{ corriente: 'Y8', unidad: 'kg', declarado: 10, observado: 12, tipo: 'CANTIDAD_DIFERENTE' }]) });
    expect(generatorIntake().motivos).toEqual(['CANTIDAD_DIFERENTE']);
  });
  it('adds the not-registered motive and its scope to the evidence', async () => {
    await recordFindingIntakes(tx, { adendaId: 'a2', referencia: 'M-1', generadorId: 'g1', creadoPorId: 'op',
      informe: informe([{ corriente: 'Y34', unidad: 'kg', declarado: null, observado: 1, tipo: 'Y_OMITIDA' }]), alcanceGenerador: { estado: 'REQUIERE_EXCEPCION', corrientes: ['Y34'] } });
    expect(generatorIntake().motivos).toEqual(['Y_OMITIDA', 'Y_NO_INSCRIPTA_GENERADOR']);
    expect(generatorIntake().evidencia.alcanceGenerador).toEqual({ estado: 'REQUIERE_EXCEPCION', corrientes: ['Y34'] });
  });
  it('flags a repeated not-registered stream even without a difference against the manifest', async () => {
    await recordFindingIntakes(tx, { adendaId: 'a3', referencia: 'M-1', generadorId: 'g1', creadoPorId: 'op', informe: informe([]),
      alcanceGenerador: { estado: 'BLOQUEADA', corrientes: ['Y12'], excepcionAbierta: { id: 'e0', corrientes: ['Y34'] } } });
    expect(generatorIntake().motivos).toEqual(['Y_NO_INSCRIPTA_REITERADA']);
  });
  it('without the rule (no scope) and without differences, no generator antecedent', async () => {
    await recordFindingIntakes(tx, { adendaId: 'a4', referencia: 'M-1', generadorId: 'g1', creadoPorId: 'op', informe: informe([]) });
    expect(generatorIntake()).toBeUndefined();
  });
});
