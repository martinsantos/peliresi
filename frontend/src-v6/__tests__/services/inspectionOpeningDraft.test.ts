import { beforeEach, describe, expect, it } from 'vitest';
import { inspectionOpeningKey, readInspectionOpening, writeInspectionOpening, type InspectionOpeningDraft } from '../../services/inspectionOpeningDraft';

const owner = JSON.stringify(['qa-inspector', 'INSPECTOR', null]);
const base = (): InspectionOpeningDraft => ({ version: 1, owner, values: {
  type: 'GENERADOR', actorId: '', withoutActor: true, inspectionType: 'ESPONTANEA', description: 'QA hallazgo',
  assignedInspector: '', numeroActa: '', ubicacion: 'QA lugar', fechaProgramada: '', source: null,
} });
const key = 'd3d28d77-7a7a-4e54-a4e1-266a6ca7a425';
const input = () => ({ clienteId: key, tipoInspeccion: 'ESPONTANEA' as const, tipoActor: null, actorId: null, observaciones: 'QA hallazgo', ubicacion: 'QA lugar' });
beforeEach(() => localStorage.clear());

describe('inspection opening recovery', () => {
  it('persists the exact command and isolates each account and representation', () => {
    const draft = base();
    draft.command = { input: input(), attempts: 1, status: 'pending' };
    writeInspectionOpening(owner, draft);
    expect(readInspectionOpening(owner)).toEqual(draft);
    expect(readInspectionOpening(JSON.stringify(['qa-inspector', 'ADMIN', null]))).toBeNull();
    expect(readInspectionOpening(JSON.stringify(['otro-inspector', 'INSPECTOR', null]))).toBeNull();
  });
  it('never silently replaces malformed or differently scoped copies', () => {
    localStorage.setItem(inspectionOpeningKey(owner), '{broken');
    expect(() => readInspectionOpening(owner)).toThrow(/leer la apertura/);
    localStorage.setItem(inspectionOpeningKey(owner), JSON.stringify({ ...base(), owner: 'otro' }));
    expect(() => readInspectionOpening(owner)).toThrow(/verificar la apertura/);
    expect(localStorage.getItem(inspectionOpeningKey(owner))).toContain('otro');
  });
  it('accepts a confirmed receipt and only a first-attempt explicit rejection', () => {
    const draft = base();
    draft.command = { input: input(), attempts: 2, status: 'confirmed', receipt: { id: 'qa-id', numero: 'IRP-QA' } };
    writeInspectionOpening(owner, draft);
    expect(readInspectionOpening(owner)?.command?.receipt?.numero).toBe('IRP-QA');
    draft.command = { input: input(), attempts: 2, status: 'rejected', rejection: 'No autorizado' };
    expect(() => writeInspectionOpening(owner, draft)).toThrow();
    expect(readInspectionOpening(owner)?.command?.status).toBe('confirmed');
  });
  it('fails closed if a command includes unexpected fields or storage cannot save', () => {
    const draft = base();
    draft.command = { input: { ...input(), latitud: 90 }, attempts: 0, status: 'pending' };
    expect(() => writeInspectionOpening(owner, draft)).toThrow();
    const unavailable = { getItem: () => null, setItem: () => { throw Error('quota'); }, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } as Storage;
    expect(() => writeInspectionOpening(owner, base(), unavailable)).toThrow('quota');
  });
  it('rejects a saved command that no longer matches the visible form', () => {
    const draft = base();
    draft.command = { input: { ...input(), observaciones: 'Otro texto' }, attempts: 1, status: 'pending' };
    expect(() => writeInspectionOpening(owner, draft)).toThrow();
  });
});
