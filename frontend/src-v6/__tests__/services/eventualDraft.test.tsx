import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { emptyEventualDraft, eventualDraftScope, mayReplaceEventualDraft, retainEventualDraft, validEventualDraft } from '../../services/eventualDraft';
import { draftConflicts } from '../../utils/draftConflicts';

const key = 'sitrep:eventual-test';
const id = '00000000-0000-4000-8000-000000000001';
const pending = () => ({ ...emptyEventualDraft(), pendingCreate: { id, body: { patente:'', motivo:'QA', residuos:[{ corriente:'Y1', cantidad:1, unidad:'kg' }] } } });
const save = (value: unknown, savedAt = Date.now()) => localStorage.setItem(key, JSON.stringify({ version:1, revision:'revision', savedAt, value }));
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
it('retains an unconfirmed creation beyond the usual draft lifetime, including a clock change', () => {
 for (const savedAt of [Date.now() - 8 * 86400000, Date.now() + 86400000]) {
  save(pending(), savedAt);
  const view = renderHook(() => useRecoverableForm(key, emptyEventualDraft(), validEventualDraft, { retainExpired:retainEventualDraft, rejectUnreadable:true }));
  expect(view.result.current.value.pendingCreate?.id).toBe(id); expect(view.result.current.restored).toBe(true); view.unmount();
 }
});
it('does not replace another unconfirmed send or unreadable storage', () => {
 save(pending()); expect(mayReplaceEventualDraft(key)).toBe(false); expect(mayReplaceEventualDraft(key, id)).toBe(true);
 localStorage.setItem(key, '{damaged'); expect(mayReplaceEventualDraft(key, id)).toBe(false);
 const view = renderHook(() => useRecoverableForm(key, emptyEventualDraft(), validEventualDraft, { retainExpired:retainEventualDraft, rejectUnreadable:true }));
 expect(view.result.current.error).toBe(true);
 act(() => { expect(view.result.current.update(v => ({ ...v, motivo:'QA' })).saved).toBe(false); });
 expect(localStorage.getItem(key)).toBe('{damaged');
});
it('keeps an invalid intermediate value on screen without corrupting the last saved copy', () => {
 const view = renderHook(() => useRecoverableForm(key, emptyEventualDraft(), validEventualDraft, { retainExpired:retainEventualDraft, rejectUnreadable:true }));
 act(() => { expect(view.result.current.update(v => ({ ...v, motivo:'Saved' })).saved).toBe(true); });
 const saved = localStorage.getItem(key);
 act(() => { expect(view.result.current.update(v => ({ ...v, residuos:[{ corriente:'Y1', cantidad:Infinity, unidad:'kg' }] })).saved).toBe(false); });
 expect(view.result.current.error).toBe(true); expect(localStorage.getItem(key)).toBe(saved);
 act(() => { expect(view.result.current.update(v => ({ ...v, residuos:[{ corriente:'Y1', cantidad:1, unidad:'kg' }] })).saved).toBe(true); });
 expect(view.result.current.error).toBe(false); expect(JSON.parse(localStorage.getItem(key)!).value.residuos[0].cantidad).toBe(1);
});
it('does not overwrite a draft while a conflict copy is unreadable', () => {
 const journalKey = 'sitrep:draft-conflict:v1:' + encodeURIComponent(key) + ':writer';
 localStorage.setItem(journalKey, '{damaged'); save({ ...emptyEventualDraft(), motivo:'saved' });
 const original = localStorage.getItem(key);
 const view = renderHook(() => useRecoverableForm(key, emptyEventualDraft(), validEventualDraft, { retainExpired:retainEventualDraft, rejectUnreadable:true }));
 expect(view.result.current.error).toBe(true);
 act(() => { expect(view.result.current.update(v => ({ ...v, motivo:'changed' })).saved).toBe(false); });
 expect(localStorage.getItem(key)).toBe(original); expect(localStorage.getItem(journalKey)).toBe('{damaged');
});
it('retains a conflicting unconfirmed send after seven days', () => {
 const journal = draftConflicts(key, validEventualDraft, retainEventualDraft);
 const saved = journal.save(pending(), 'writer');
 const journalKey = 'sitrep:draft-conflict:v1:' + encodeURIComponent(key) + ':writer';
 localStorage.setItem(journalKey, JSON.stringify({ ...saved, savedAt:Date.now() - 8 * 86400000 }));
 const view = renderHook(() => useRecoverableForm(key, emptyEventualDraft(), validEventualDraft, { retainExpired:retainEventualDraft, rejectUnreadable:true }));
 expect(view.result.current.conflict).toBe(true); expect(view.result.current.conflictSaved).toBe(true);
 expect(view.result.current.value.pendingCreate?.id).toBe(id);
});
it('keeps an unfinished draft after the ordinary seven-day period', () => {
 save({ ...emptyEventualDraft(), motivo:'old' }, Date.now() - 8 * 86400000);
 const view = renderHook(() => useRecoverableForm(key, emptyEventualDraft(), validEventualDraft, { retainExpired:retainEventualDraft, rejectUnreadable:true }));
 expect(view.result.current.value.motivo).toBe('old'); expect(view.result.current.error).toBe(false);
 expect(localStorage.getItem(key)).toContain('old');
});
it('isolates a temporary view from the account owner and requires a matching session', () => {
 const token = (payload: object) => 'qa.' + btoa(JSON.stringify(payload)) + '.qa';
 const own = eventualDraftScope('context', 'person', token({ id:'person' }));
 const temporary = eventualDraftScope('context', 'person', token({ id:'person', impersonatedBy:'admin' }));
 expect(own).toBeTruthy(); expect(temporary).toBeTruthy(); expect(temporary).not.toBe(own);
 expect(eventualDraftScope('context','person',token({ id:'other' }))).toBe('');
 expect(eventualDraftScope('context','person',null)).toBe('');
});
