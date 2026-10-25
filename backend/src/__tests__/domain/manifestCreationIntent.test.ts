import { describe, expect, it, vi } from 'vitest';
import { manifestCreationIntent, readManifestCreationReceipt, recordManifestCreation } from '../../domain/manifestCreationIntent';

const key = 'c84b3820-024e-4e4b-a54a-06c62f40f11a';
const body = { generadorId: 'g', operadorId: 'o', residuos: [{ tipoResiduoId: 'y1', cantidad: 10, unidad: 'kg' }] };
const intent = manifestCreationIntent(key, 'u', 'GENERADOR', undefined, body);
const receipt = { id: intent.id, usuarioId: 'u', manifiestoId: 'm', modulo: 'MANIFIESTOS', accion: 'CREAR_MANIFIESTO', datosDespues: JSON.stringify({ version: 1, requestHash: intent.hash }) };
const transaction = (value: unknown) => ({ auditoria: { findUnique: vi.fn().mockResolvedValue(value), create: vi.fn().mockResolvedValue(receipt) } });

describe('durable manifest creation receipt', () => {
  it('recognizes the same request independently of object order and UUID case', () => {
    const reordered = { residuos: [{ unidad: 'kg', cantidad: 10, tipoResiduoId: 'y1' }], operadorId: 'o', generadorId: 'g', observaciones: undefined };
    expect(manifestCreationIntent(key.toUpperCase(), 'u', 'GENERADOR', undefined, reordered)).toEqual(intent);
  });
  it('separates people, roles, companies, activities and establishments', () => {
    const variants = [
      manifestCreationIntent(key, 'other', 'GENERADOR', undefined, body),
      manifestCreationIntent(key, 'u', 'OPERADOR', undefined, body),
      ...[{ empresaId: 'e' }, { empresaId: 'e', actividadId: 'a' }, { empresaId: 'e', actividadId: 'a', establecimientoId: 's' }]
        .map(context => manifestCreationIntent(key, 'u', 'GENERADOR', context, body)),
    ];
    expect(new Set([intent, ...variants].map(value => value.id)).size).toBe(6);
  });
  it('returns only the committed manifest and writes no second receipt on lookup', async () => {
    const tx = transaction(receipt);
    await expect(readManifestCreationReceipt(tx as any, intent)).resolves.toBe('m');
    expect(tx.auditoria.create).not.toHaveBeenCalled();
    await expect(readManifestCreationReceipt(transaction(null) as any, intent)).resolves.toBeNull();
  });
  it('rejects reuse of the same request identity with a changed quantity', async () => {
    const changed = manifestCreationIntent(key, 'u', 'GENERADOR', undefined, { ...body, residuos: [{ ...body.residuos[0], cantidad: 11 }] });
    expect(changed.id).toBe(intent.id);
    await expect(readManifestCreationReceipt(transaction(receipt) as any, changed)).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each([{ datosDespues: 'broken' }, { datosDespues: 'null' }, { usuarioId: 'other' }, { modulo: 'other' }, { accion: 'other' }, { manifiestoId: null }])('fails closed on a damaged or foreign receipt %j', async change => {
    await expect(readManifestCreationReceipt(transaction({ ...receipt, ...change }) as any, intent)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('stores a receipt in the supplied transaction without duplicating private form contents', async () => {
    const tx = transaction(null);
    await recordManifestCreation(tx as any, intent, 'm');
    expect(tx.auditoria.create).toHaveBeenCalledWith({ data: receipt });
    expect(receipt.datosDespues).not.toContain('generadorId');
  });
});
