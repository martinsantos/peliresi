import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { manifestDraftScope, useManifestDraft, type ManifestDraft } from '../../hooks/useManifestDraft';

const initial: ManifestDraft = { step: 1, form: { generador: '', generadorId: '', modalidad: 'FIJO', transportista: '', operador: '', vehiculoId: '', choferId: '', fechaRetiro: '2026-10-23', observaciones: '', residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }] } };
beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
describe('manifest form continuity', () => {
  it('recovers all fields and the step after leaving and mounting again without a server write', () => {
    const first = renderHook(() => useManifestDraft('account:role:actor', initial));
    act(() => first.result.current.update({ ...initial, step: 3, form: { ...initial.form, generadorId: 'g', transportista: 't', operador: 'o', vehiculoId: 'v', choferId: 'c', observaciones: 'Texto con ñ', residuos: [{ tipo: 'y8', cantidad: '1.5', unidad: 'kg' }] } }));
    const saved = first.result.current.draft;
    first.unmount();
    const second = renderHook(() => useManifestDraft('account:role:actor', initial));
    expect(second.result.current.draft).toEqual(saved);
    expect(second.result.current.restored).toBe(true);
    expect(second.result.current.saved).toBe(true);
  });
  it('isolates persons, roles, actor, training and company establishment', () => {
    const base = { id: 'a', rol: 'OPERADOR', actorId: 'o' };
    const scopes = [base, { ...base, id: 'b' }, { ...base, rol: 'GENERADOR' }, { ...base, actorId: 'o2' }, { ...base, training: true }, { ...base, empresaContexto: { empresaId: 'e', actividadId: 'r', establecimientoId: 's' } }, { ...base, empresaContexto: { empresaId: 'e', actividadId: 'r', establecimientoId: 's2' } }].map(manifestDraftScope);
    expect(new Set(scopes).size).toBe(scopes.length);
    const first = renderHook(() => useManifestDraft(scopes[0], initial));
    act(() => first.result.current.update({ ...initial, step: 2 }));
    for (const scope of scopes.slice(1)) expect(renderHook(() => useManifestDraft(scope, initial)).result.current.draft).toEqual(initial);
  });
  it('clears after success or explicit discard and never resurrects the old input', () => {
    const first = renderHook(() => useManifestDraft('one', initial));
    act(() => first.result.current.update({ ...initial, step: 3 }));
    act(() => first.result.current.clear());
    first.unmount();
    expect(renderHook(() => useManifestDraft('one', initial)).result.current.draft).toEqual(initial);
  });
  it('reports storage failure instead of claiming a saved draft', () => {
    const hook = renderHook(() => useManifestDraft('one', initial));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    act(() => hook.result.current.update({ ...initial, step: 2 }));
    expect(hook.result.current.draft.step).toBe(2);
    expect(hook.result.current.saved).toBe(false);
    expect(hook.result.current.error).toBeTruthy();
    hook.unmount();
    const reopened = renderHook(() => useManifestDraft('one', initial));
    expect(reopened.result.current.draft.step).toBe(2);
    expect(reopened.result.current.saved).toBe(false);
    expect(reopened.result.current.dirty).toBe(true);
    vi.restoreAllMocks();
    act(() => reopened.result.current.clear());
  });
  it('rejects an expired, malformed or future-version draft', () => {
    const hook = renderHook(() => useManifestDraft('one', initial));
    act(() => hook.result.current.update({ ...initial, step: 2 }));
    hook.unmount();
    const key = sessionStorage.key(0)!;
    const valid = JSON.parse(sessionStorage.getItem(key)!);
    for (const invalid of [{ ...valid, savedAt: 1 }, { ...valid, version: 999 }, { ...valid, draft: { step: 2, form: null } }]) {
      sessionStorage.setItem(key, JSON.stringify(invalid));
      const attempt = renderHook(() => useManifestDraft('one', initial));
      expect(attempt.result.current.draft).toEqual(initial);
      attempt.unmount();
    }
  });
});
