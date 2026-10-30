import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draftConflicts } from '../../utils/draftConflicts';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { useManifestDraft, type ManifestDraft } from '../../hooks/useManifestDraft';

const valid = (value: unknown): value is { text: string } => !!value && typeof (value as { text: string }).text === 'string';
const initial = { text: '' };
const manifest: ManifestDraft = { step: 1, form: { generador: '', generadorId: '', modalidad: 'FIJO', transportista: '', operador: '', vehiculoId: '', choferId: '', fechaRetiro: '', observaciones: '', residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }] } };
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

describe('durable unresolved drafts', () => {
  it('does not edit or resolve shared storage without ownership and refreshes after acquisition', () => {
    const key = 'guarded-eventual';
    const record = (revision: string, text: string) => JSON.stringify({ version: 1, revision, savedAt: Date.now(), value: { text } });
    localStorage.setItem(key, record('first', 'Antes'));
    let owned = false;
    const page = renderHook(() => useRecoverableForm(key, initial, valid, { canWrite: () => owned }));
    localStorage.setItem(key, record('second', 'Guardado por la otra pestaña'));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })));
    act(() => { expect(page.result.current.update({ text: 'No autorizado' }).saved).toBe(false); });
    act(() => { expect(page.result.current.clear()).toBe(false); page.result.current.reload(); });
    expect(JSON.parse(localStorage.getItem(key)!).value.text).toBe('Guardado por la otra pestaña');
    owned = true;
    act(() => page.result.current.synchronize());
    expect(page.result.current.value.text).toBe('Guardado por la otra pestaña');
    act(() => page.result.current.update({ text: 'Continuación segura' }));
    expect(JSON.parse(localStorage.getItem(key)!).value.text).toBe('Continuación segura');
  });

  it('keeps preserved conflicts when acquiring ownership', () => {
    const key = 'guarded-conflict';
    localStorage.setItem(key, JSON.stringify({ version: 1, revision: 'canonical', savedAt: Date.now(), value: { text: 'Actual' } }));
    const journal = draftConflicts(key, valid);
    journal.save({ text: 'Copia pendiente' }, 'other-tab');
    let owned = false;
    const page = renderHook(() => useRecoverableForm(key, initial, valid, { canWrite: () => owned }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })));
    expect(journal.list()).toHaveLength(1);
    owned = true; act(() => page.result.current.synchronize());
    expect(page.result.current.conflict).toBe(true);
    expect(page.result.current.value.text).toBe('Copia pendiente');
    expect(journal.list()).toHaveLength(1);
  });

  it('acknowledges a confirmed write without changing visible inputs or resurrecting them on reopen', () => {
    const key = 'acknowledged-company';
    const page = renderHook(() => useRecoverableForm(key, initial, valid));
    act(() => page.result.current.update({ text: 'Cambio confirmado' }));
    act(() => { expect(page.result.current.acknowledge()).toBe(true); });
    expect(page.result.current.value.text).toBe('Cambio confirmado');
    expect(JSON.parse(localStorage.getItem(key)!).value).toBeNull();
    page.unmount();
    const reopened = renderHook(() => useRecoverableForm(key, { text: 'Resultado actual del servidor' }, valid));
    expect(reopened.result.current.value.text).toBe('Resultado actual del servidor');
    expect(reopened.result.current.restored).toBe(false);
  });
  it('restores a manifest conflict using only storage after a fresh process', () => {
    const scope = 'cold-manifest';
    const key = 'sitrep:manifest-form:v1:' + scope;
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), draft: { ...manifest, form: { ...manifest.form, observaciones: 'Otra versión' } } }));
    // Seed only persisted bytes: no hook or in-memory map existed in this process.
    draftConflicts(key, (value): value is ManifestDraft => !!value).save({ ...manifest, step: 3, form: { ...manifest.form, observaciones: 'Mi versión recuperable' } }, 'closed-tab');
    const page = renderHook(() => useManifestDraft(scope, manifest));
    expect(page.result.current.draft.step).toBe(3);
    expect(page.result.current.draft.form.observaciones).toBe('Mi versión recuperable');
    expect(page.result.current.conflictSaved).toBe(true);
    expect(page.result.current.conflict).toBe(true);
    act(() => page.result.current.reload());
    expect(page.result.current.draft.form.observaciones).toBe('Otra versión');
    expect(page.result.current.conflict).toBe(false);
    expect(draftConflicts(key, (value): value is ManifestDraft => !!value).list()).toHaveLength(0);
  });

  it('persists every edit made while a generic form is conflicted', () => {
    const key = 'conflict-edit';
    const page = renderHook(() => useRecoverableForm(key, initial, valid));
    act(() => page.result.current.update({ text: 'Local' }));
    localStorage.setItem(key, JSON.stringify({ version: 1, revision: 'other', savedAt: Date.now(), value: { text: 'Remoto' } }));
    act(() => page.result.current.update({ text: 'Local completo' }));
    expect(page.result.current.conflictSaved).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)!).value.text).toBe('Remoto');
    expect(draftConflicts(key, valid).list().map(entry => entry.value.text)).toEqual(['Local completo']);
    act(() => page.result.current.update({ text: 'Local completo con ñ' }));
    expect(draftConflicts(key, valid).list().map(entry => entry.value.text)).toEqual(['Local completo con ñ']);
    page.unmount(); sessionStorage.clear();
    const reopened = renderHook(() => useRecoverableForm(key, initial, valid));
    expect(reopened.result.current.value.text).toBe('Local completo con ñ');
    expect(reopened.result.current.conflict).toBe(true);
    act(() => reopened.result.current.overwrite());
    expect(JSON.parse(localStorage.getItem(key)!).value.text).toBe('Local completo con ñ');
    expect(draftConflicts(key, valid).list()).toHaveLength(0);
  });

  it('keeps independent copies from three tabs and resolves them explicitly one at a time', () => {
    const key = 'many-tabs', journal = draftConflicts(key, valid);
    localStorage.setItem(key, JSON.stringify({ version: 1, revision: 'canonical', savedAt: Date.now(), value: { text: 'Versión actual' } }));
    journal.save({ text: 'Pestaña A' }, 'a'); journal.save({ text: 'Pestaña B' }, 'b');
    const page = renderHook(() => useRecoverableForm(key, initial, valid));
    expect(page.result.current.conflictCount).toBe(2);
    const first = page.result.current.value.text;
    act(() => page.result.current.overwrite());
    expect(page.result.current.conflict).toBe(true);
    expect(page.result.current.conflictCount).toBe(1);
    expect(page.result.current.value.text).not.toBe(first);
    act(() => page.result.current.reload());
    expect(page.result.current.conflict).toBe(false);
    expect(page.result.current.value.text).toBe(first);
    expect(journal.list()).toHaveLength(0);
  });

  it('never deletes a newer version of a conflict selected earlier', () => {
    const journal = draftConflicts('optimistic-delete', valid);
    const old = journal.save({ text: 'Uno' }, 'writer');
    journal.save({ text: 'Dos' }, 'writer');
    journal.remove(old);
    expect(journal.list()[0].value.text).toBe('Dos');
  });

  it('isolates conflicts by person, role and record and rejects invalid or expired values', () => {
    const a = draftConflicts('person/role/record1', valid), b = draftConflicts('person/role/record2', valid);
    a.save({ text: 'Privado' }, 'a');
    expect(b.list()).toEqual([]);
    const key = localStorage.key(0)!;
    const record = JSON.parse(localStorage.getItem(key)!);
    for (const invalid of [{ ...record, value: null }, { ...record, savedAt: 1 }, { ...record, savedAt: Date.now() + 100000 }, { ...record, version: 2 }, { ...record, id: 'wrong' }]) {
      localStorage.setItem(key, JSON.stringify(invalid)); expect(a.list()).toEqual([]);
    }
  });

  it('reports failed conflict storage and preserves input instead of promising recovery', () => {
    const key = 'quota-conflict';
    const page = renderHook(() => useRecoverableForm(key, initial, valid));
    act(() => page.result.current.update({ text: 'Local' }));
    localStorage.setItem(key, JSON.stringify({ version: 1, revision: 'other', savedAt: Date.now(), value: { text: 'Otra' } }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    act(() => page.result.current.update({ text: 'Último texto' }));
    expect(page.result.current.value.text).toBe('Último texto');
    expect(page.result.current.conflictSaved).toBe(false);
    expect(page.result.current.error).toBe(true);
    expect(page.result.current.saved).toBe(false);
  });
});
