import { describe, expect, it, vi } from 'vitest';
import { buildDeclaredInspectionSnapshot, ensureInspectionDeclaredComparisons, splitDeclaredWasteStreams } from '../../services/inspectionDeclaredSnapshot.service';

describe('inspection declared waste streams', () => {
  it('splits slash-separated Y streams into stable unique codes', () => {
    expect(splitDeclaredWasteStreams('Y4/Y5/Y6/Y48/Y5')).toEqual(['Y4', 'Y5', 'Y6', 'Y48']);
  });

  it('normalises spaces, dashes and mixed separators', () => {
    expect(splitDeclaredWasteStreams('y 8; Y-9, Y10\nY11')).toEqual(['Y8', 'Y9', 'Y10', 'Y11']);
  });

  it('does not invent streams when the registry has no Y code', () => {
    expect(splitDeclaredWasteStreams('Sin corrientes informadas')).toEqual([]);
  });

  it('creates one independently reviewable field per authorized operator treatment', async () => {
    const treatments = Array.from({ length: 30 }, (_, index) => ({
      id: `treatment-${index + 1}`, metodo: index % 2 ? 'Incineración' : 'Estabilización', numeroResolucion: `R-${index + 1}`,
      tipoResiduo: { codigo: `Y${index + 1}`, nombre: `Residuo ${index + 1}` },
    }));
    const operator = {
      id: 'operator-1', razonSocial: 'Operador QA', cuit: '30-00000000-0', domicilio: 'Mendoza',
      numeroHabilitacion: 'H-1', vencimientoHabilitacion: null, expedienteInscripcion: null,
      resolucionDPA: null, tecnologia: 'Tecnología de prueba', corrientesY: 'Y1/Y2',
      tratamientos: treatments, sedes: [], documentos: [],
    };
    const db = { operador: { findUniqueOrThrow: vi.fn().mockResolvedValue(operator) } };
    const snapshot = await buildDeclaredInspectionSnapshot(db as any, 'OPERADOR', operator.id);
    const fields = snapshot.fields.filter((row) => row.categoria === 'Tratamientos');

    expect(fields).toHaveLength(30);
    expect(new Set(fields.map((row) => row.codigo)).size).toBe(30);
    expect(fields[0]).toMatchObject({ codigo: 'ACT-TRATAMIENTO-treatment-1', valorDeclarado: expect.stringContaining('R-1') });
    expect(snapshot.fields.some((row) => row.codigo === 'ACT-TRATAMIENTOS')).toBe(false);
    expect(snapshot.fields.map((row) => row.orden)).toEqual([...snapshot.fields.map((row) => row.orden)].sort((a, b) => a - b));
  });

  it('restores a reviewed legacy summary on closed acts instead of leaving new pending rows', async () => {
    const update = vi.fn().mockResolvedValue({});
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const db = {
      comparacionInspeccion: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'summary', codigo: 'RES-CORRIENTES-RESUMEN', valorDeclarado: 'Y8/Y9', resultado: 'COINCIDE', valorObservado: 'Y8/Y9', observacion: null, _count: { evidencias: 0 } },
          { id: 'y8', codigo: 'RES-Y8', resultado: 'PENDIENTE', valorObservado: null, observacion: null, _count: { evidencias: 0 } },
          { id: 'y9', codigo: 'RES-Y9', resultado: 'PENDIENTE', valorObservado: null, observacion: null, _count: { evidencias: 0 } },
        ]),
        deleteMany,
        update,
      },
    };

    await ensureInspectionDeclaredComparisons(db as any, {
      id: 'closed-inspection',
      estado: 'CERRADA_CONFORME',
      tipoActor: 'OPERADOR',
      generadorId: null,
      transportistaId: null,
      operadorId: 'operator-1',
      declaradoSnapshot: { schemaVersion: 2, fields: [] },
    } as any);

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['y8', 'y9'] } } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codigo: 'RES-CORRIENTES', etiqueta: 'Corrientes Y autorizadas' }) }));
  });
});
