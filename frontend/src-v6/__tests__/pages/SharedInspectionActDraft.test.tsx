import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../pages/inspecciones/SharedInspectionActPage';
import { actPresentationDraftKey, readPresentationDraft } from '../../services/inspectionActDrafts';

const future = new Date(Date.now() + 86400000).toISOString();
const act0 = { numero: 'QA-001', firmante: 'Persona de práctica', expiresAt: future, mensajes: [] as any[] };
type Reply = { status: number; body: any };
let replies: Reply[] = [];
const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
  const next = replies.shift() || { status: 200, body: { data: act0 } };
  if (next.status === 0) throw new TypeError('Failed to fetch');
  return { ok: next.status < 300, status: next.status, json: async () => next.body, blob: async () => new Blob() } as Response;
});
function open(accesoId = 'grant-a') {
  window.location.hash = '#' + 'a'.repeat(64);
  return render(<MemoryRouter initialEntries={[`/acta-compartida/${accesoId}`]}><Routes><Route path="/acta-compartida/:accesoId" element={<Page />} /></Routes></MemoryRouter>);
}
const text = 'Descargo artificial con más de diez caracteres.';
async function fill() {
  await screen.findByText('Acta QA-001');
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Persona de práctica' } });
  fireEvent.change(screen.getByLabelText('Tipo de presentación'), { target: { value: 'APELACION' } });
  fireEvent.change(screen.getByLabelText('Qué querés informar'), { target: { value: text } });
}
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(String(init!.body)));

beforeEach(() => { localStorage.clear(); replies = []; fetchMock.mockClear(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('limited acta link — unsent presentation', () => {
  it('recovers name, type and text after closing and reopening the page', async () => {
    const first = open(); await fill(); first.unmount();
    open();
    expect(await screen.findByDisplayValue(text)).toBeTruthy();
    expect((screen.getByLabelText('Nombre y apellido') as HTMLInputElement).value).toBe('Persona de práctica');
    expect((screen.getByLabelText('Tipo de presentación') as HTMLSelectElement).value).toBe('APELACION');
    expect(screen.getByText(/Recuperamos el texto que no se había enviado/)).toBeTruthy();
  });

  it('keeps the text and the same request id across a failed send and a reopen, then clears after confirmation', async () => {
    const first = open(); await fill();
    replies = [{ status: 0, body: null }];
    fireEvent.click(screen.getByRole('button', { name: 'Registrar presentación' }));
    const failure = await screen.findByText(/Tu texto sigue guardado en este dispositivo/);
    // The failure is announced next to the button, not only at the top of the page.
    expect(failure.closest('form')).toBeTruthy(); expect(failure.textContent).toContain('sin conexión con SITREP');
    const pending = readPresentationDraft('grant-a');
    expect(pending?.texto).toBe(text); expect(pending?.clienteId).toMatch(/^[0-9a-f-]{36}$/);
    first.unmount();
    open(); await screen.findByDisplayValue(text);
    replies = [{ status: 201, body: { data: { id: 'p1', fecha: new Date().toISOString() } } }];
    fireEvent.click(screen.getByRole('button', { name: 'Registrar presentación' }));
    expect(await screen.findByText(/Presentación registrada/)).toBeTruthy();
    expect(posts().map(p => p.clienteId)).toEqual([pending!.clienteId, pending!.clienteId]);
    expect(localStorage.getItem(actPresentationDraftKey('grant-a'))).toBeNull();
  });

  it('starts a new request id when the text changes after a failure', async () => {
    open(); await fill();
    replies = [{ status: 503, body: { message: 'Servicio no disponible' } }];
    fireEvent.click(screen.getByRole('button', { name: 'Registrar presentación' }));
    await screen.findByText(/Servicio no disponible/);
    const before = readPresentationDraft('grant-a')!.clienteId;
    fireEvent.change(screen.getByLabelText('Qué querés informar'), { target: { value: text + ' Corregido.' } });
    expect(readPresentationDraft('grant-a')!.clienteId).toBe('');
    expect(before).not.toBe('');
  });

  it('removes the stored text when the link is revoked or expired', async () => {
    const first = open(); await fill(); first.unmount();
    replies = [{ status: 403, body: { message: 'Este enlace fue revocado. Solicitá uno nuevo al equipo de inspección.' } }];
    open();
    expect(await screen.findByText(/fue revocado/)).toBeTruthy();
    expect(localStorage.getItem(actPresentationDraftKey('grant-a'))).toBeNull();
    expect(screen.queryByDisplayValue(text)).toBeNull();
  });

  it('keeps the text through a connection failure while opening', async () => {
    const first = open(); await fill(); first.unmount();
    replies = [{ status: 0, body: null }];
    open(); await screen.findByRole('alert');
    expect(readPresentationDraft('grant-a')?.texto).toBe(text);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByDisplayValue(text)).toBeTruthy();
  });

  it('does not show one link draft in another link', async () => {
    const first = open('grant-a'); await fill(); first.unmount();
    open('grant-b'); await screen.findByText('Acta QA-001');
    expect(screen.queryByDisplayValue(text)).toBeNull();
    expect(readPresentationDraft('grant-a')?.texto).toBe(text);
  });

  it('drops a draft that already appears registered after a lost answer', async () => {
    const first = open(); await fill(); first.unmount();
    replies = [{ status: 200, body: { data: { ...act0, mensajes: [{ id: 'p1', autoridad: false, tipo: 'APELACION', nombre: 'Persona de práctica', texto: text, fecha: new Date().toISOString() }] } } }];
    open();
    expect(await screen.findByText(/ya estaba registrada/)).toBeTruthy();
    expect(localStorage.getItem(actPresentationDraftKey('grant-a'))).toBeNull();
  });

  it('expires the stored text with the link even without connection', () => {
    localStorage.setItem(actPresentationDraftKey('old'), JSON.stringify({ v: 1, nombre: 'X', tipo: 'DESCARGO', texto: 'texto viejo', clienteId: '', savedAt: '', expiresAt: '2020-01-01T00:00:00Z' }));
    expect(readPresentationDraft('old')).toBeNull();
    expect(localStorage.getItem(actPresentationDraftKey('old'))).toBeNull();
  });

  it('follows a newer copy from another tab, and flags a real conflict', async () => {
    open(); await fill();
    const key = actPresentationDraftKey('grant-a'), mine = localStorage.getItem(key)!;
    const theirs = JSON.stringify({ ...JSON.parse(mine), texto: 'Texto actualizado en otra pestaña.' });
    localStorage.setItem(key, theirs);
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key, oldValue: mine, newValue: theirs })); });
    expect(await screen.findByDisplayValue('Texto actualizado en otra pestaña.')).toBeTruthy();
    const other = JSON.stringify({ ...JSON.parse(theirs), texto: 'Otra versión distinta.' });
    localStorage.setItem(key, other);
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key, oldValue: 'algo que esta pestaña no vio', newValue: other })); });
    expect(await screen.findByText('Este borrador se modificó en otra pestaña.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Conservar el texto de esta pestaña' }));
    await waitFor(() => expect(readPresentationDraft('grant-a')?.texto).toBe('Texto actualizado en otra pestaña.'));
  });
});
