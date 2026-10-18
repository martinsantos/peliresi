import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareTransportAssignment, readTransportAssignment } from '../../domain/manifiestoTransportAssignment';

const vehicle = { id: 'v2', patente: 'QA002ZZ', marca: 'QA', modelo: 'Segundo' };
const driver = { id: 'c2', nombre: 'Chofer', apellido: 'Dos', dni: '00000002' };
const db = { vehiculo: { findFirst: vi.fn() }, chofer: { findFirst: vi.fn() } };
const selection = { modalidad: 'FIJO' as const, transportistaId: 't1', vehiculoId: 'v2', choferId: 'c2' };

describe('explicit manifest transport assignment', () => {
  beforeEach(() => { vi.clearAllMocks(); db.vehiculo.findFirst.mockResolvedValue(vehicle); db.chofer.findFirst.mockResolvedValue(driver); });

  it('does not guess a vehicle or driver for legacy/unassigned requests', async () => {
    expect(await prepareTransportAssignment(db as any, { modalidad: 'FIJO', transportistaId: 't1' })).toBeUndefined();
    expect(db.vehiculo.findFirst).not.toHaveBeenCalled();
    expect(db.chofer.findFirst).not.toHaveBeenCalled();
  });

  it('queries selected IDs under their carrier and active status and snapshots only evidenced fields', async () => {
    const result = await prepareTransportAssignment(db as any, selection);
    expect(db.vehiculo.findFirst).toHaveBeenCalledWith({ where: { id: 'v2', transportistaId: 't1', activo: true }, select: { id: true, patente: true, marca: true, modelo: true } });
    expect(db.chofer.findFirst).toHaveBeenCalledWith({ where: { id: 'c2', transportistaId: 't1', activo: true }, select: { id: true, nombre: true, apellido: true, dni: true } });
    expect(result).toEqual({ version: 1, transportistaId: 't1', vehiculo: vehicle, chofer: driver });
  });

  it.each(['vehiculo', 'chofer'] as const)('rejects nonexistent, foreign or inactive %s without accepting the other resource', async (kind) => {
    db[kind].findFirst.mockResolvedValue(null);
    await expect(prepareTransportAssignment(db as any, selection)).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([{ vehiculoId: 'v2' }, { choferId: 'c2' }])('rejects in-situ assignment %j', async (chosen) => {
    await expect(prepareTransportAssignment(db as any, { modalidad: 'IN_SITU', ...chosen })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.vehiculo.findFirst).not.toHaveBeenCalled(); expect(db.chofer.findFirst).not.toHaveBeenCalled();
  });

  it('requires a carrier for a selected resource', async () => {
    await expect(prepareTransportAssignment(db as any, { modalidad: 'FIJO', vehiculoId: 'v2' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('permits an explicit vehicle without inventing a driver', async () => {
    expect(await prepareTransportAssignment(db as any, { ...selection, choferId: undefined })).toEqual({ version: 1, transportistaId: 't1', vehiculo: vehicle, chofer: null });
    expect(db.chofer.findFirst).not.toHaveBeenCalled();
  });

  it('returns detached values unaffected by later catalogue edits', async () => {
    const source = { ...vehicle }; db.vehiculo.findFirst.mockResolvedValue(source);
    const result = await prepareTransportAssignment(db as any, selection);
    source.patente = 'CHANGED';
    expect(result?.vehiculo?.patente).toBe('QA002ZZ');
  });

  it('reads only a validated snapshot for the same responsible carrier', () => {
    const snapshot = { version: 1, transportistaId: 't1', vehiculo: vehicle, chofer: driver };
    expect(readTransportAssignment(snapshot, 't1')).toEqual(snapshot);
    expect(readTransportAssignment(snapshot, 'other')).toBeNull();
    expect(readTransportAssignment(snapshot, null)).toBeNull();
  });

  it.each([null, undefined, {}, { version: 2 }, { version: 1, transportistaId: 't1', vehiculo: { id: 'v2' }, chofer: null }])('does not manufacture missing historical assignment from %j', value => {
    expect(readTransportAssignment(value, 't1')).toBeNull();
  });
});
