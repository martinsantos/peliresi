import { describe, expect, it, vi } from 'vitest';
import { ensureInspectionDeclaredComparisons, splitDeclaredWasteStreams } from '../../services/inspectionDeclaredSnapshot.service';

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
