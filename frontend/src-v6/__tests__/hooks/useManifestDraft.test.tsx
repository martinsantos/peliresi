import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { manifestDraftScope, useManifestDraft, type ManifestDraft } from '../../hooks/useManifestDraft';

const initial: ManifestDraft = { step: 1, form: { generador: '', generadorId: '', modalidad: 'FIJO', transportista: '', operador: '', vehiculoId: '', choferId: '', fechaRetiro: '2026-10-23', observaciones: '', residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }] } };
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear(); });
describe('manifest form continuity', () => {
  it('recovers all fields and the step after leaving and mounting again without a server write', () => {
    const first = renderHook(() => useManifestDraft('account:role:actor', initial));
    act(() => first.result.current.update({ ...initial, step: 3, form: { ...initial.form, generadorId: 'g', transportista: 't', operador: 'o', vehiculoId: 'v', choferId: 'c', observaciones: 'Texto con ñ', residuos: [{ tipo: 'y8', cantidad: '1.5', unidad: 'kg' }] } }));
    const saved = first.result.current.draft;
    first.unmount();
    sessionStorage.clear(); // A new browser session must recover persistent input.
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
    const key = localStorage.key(0)!;
    const valid = JSON.parse(localStorage.getItem(key)!);
    for (const invalid of [{ ...valid, savedAt: 1 }, { ...valid, version: 999 }, { ...valid, draft: { step: 2, form: null } }]) {
      localStorage.setItem(key, JSON.stringify(invalid));
      const attempt = renderHook(() => useManifestDraft('one', initial));
      expect(attempt.result.current.draft).toEqual(initial);
      attempt.unmount();
    }
  });
  it('migrates an already open session draft before the next edit', () => {
    const key = 'sitrep:manifest-form:v1:legacy';
    const draft = { ...initial, step: 3 };
    sessionStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), draft }));
    const first = renderHook(() => useManifestDraft('legacy', initial));
    expect(first.result.current.draft).toEqual(draft);
    expect(first.result.current.saved).toBe(true);
    expect(sessionStorage.getItem(key)).toBeNull();
    first.unmount(); sessionStorage.clear();
    expect(renderHook(() => useManifestDraft('legacy', initial)).result.current.draft).toEqual(draft);
  });
  it('does not resurrect a legacy draft after a newer successful creation or discard', () => {
    const key = 'sitrep:manifest-form:v1:legacy-clear';
    const old = { version: 1, savedAt: Date.now() - 1000, draft: { ...initial, step: 3 } };
    const first = renderHook(() => useManifestDraft('legacy-clear', initial));
    act(() => { first.result.current.update(old.draft); first.result.current.clear(); });
    first.unmount();
    sessionStorage.setItem(key, JSON.stringify(old));
    const reopened = renderHook(() => useManifestDraft('legacy-clear', initial));
    expect(reopened.result.current.draft).toEqual(initial);
    expect(reopened.result.current.restored).toBe(false);
  });
  it('syncs an untouched tab but preserves locally edited input when another tab clears', () => {
    const key = 'sitrep:manifest-form:v1:tabs';
    const hook = renderHook(() => useManifestDraft('tabs', initial));
    const other = { ...initial, step: 3, form: { ...initial.form, observaciones: 'Desde la otra pestaña' } };
    const emit = (draft: ManifestDraft | null) => {
      const raw = JSON.stringify({ version: 1, savedAt: Date.now(), draft });
      localStorage.setItem(key, raw);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw, storageArea: localStorage }));
    };
    act(() => emit(other));
    expect(hook.result.current.draft).toEqual(other);
    act(() => hook.result.current.update(previous => ({ ...previous, form: { ...previous.form, fechaRetiro: '2026-10-30' } })));
    expect(hook.result.current.draft.form.observaciones).toBe(other.form.observaciones);
    act(() => emit(null));
    expect(hook.result.current.draft.form.fechaRetiro).toBe('2026-10-30');
    expect(hook.result.current.conflict).toBe(true);
    act(() => hook.result.current.reload());
    expect(hook.result.current.draft).toEqual(initial);
    expect(hook.result.current.saved).toBe(false);
  });
  it('detects a concurrent edit before its storage event and requires a deliberate overwrite', () => {
    const key = 'sitrep:manifest-form:v1:concurrent';
    const hook = renderHook(() => useManifestDraft('concurrent', initial));
    act(() => hook.result.current.update({...initial,form:{...initial.form,observaciones:'Mi texto'}}));
    const other=JSON.stringify({version:1,savedAt:Date.now(),draft:{...initial,form:{...initial.form,observaciones:'Otro texto'}}});
    localStorage.setItem(key,other);
    act(() => expect(hook.result.current.checkConflict()).toBe(true));
    act(() => hook.result.current.update(previous=>({...previous,step:2})));
    expect(hook.result.current.draft.form.observaciones).toBe('Mi texto');
    expect(localStorage.getItem(key)).toBe(other);
    act(() => expect(hook.result.current.clear()).toBe(false));
    hook.unmount();
    const reopened=renderHook(()=>useManifestDraft('concurrent',initial));
    expect(reopened.result.current.conflict).toBe(true);
    expect(reopened.result.current.draft.form.observaciones).toBe('Mi texto');
    expect(reopened.result.current.saved).toBe(false);
    act(() => reopened.result.current.overwrite());
    expect(reopened.result.current.conflict).toBe(false);
    expect(JSON.parse(localStorage.getItem(key)!).draft.form.observaciones).toBe('Mi texto');
  });
  it('reads the latest other-tab fields even before the storage event arrives', () => {
    const key = 'sitrep:manifest-form:v1:before-event';
    const hook = renderHook(() => useManifestDraft('before-event', initial));
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), draft: { ...initial, form: { ...initial.form, observaciones: 'Otro cambio' } } }));
    act(() => hook.result.current.update(previous => ({ ...previous, step: 2 })));
    expect(hook.result.current.draft.form.observaciones).toBe('Otro cambio');
  });
  it('does not claim a successful discard when persistent storage fails', () => {
    const hook = renderHook(() => useManifestDraft('failed-clear', initial));
    act(() => hook.result.current.update({ ...initial, step: 3 }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    act(() => expect(hook.result.current.clear()).toBe(false));
    expect(hook.result.current.draft.step).toBe(3);
    expect(hook.result.current.error).toBe(true);
  });
});
