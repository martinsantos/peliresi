import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ user: { id: 'insp-1', rol: 'ADMIN', esInspector: true } as any }));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: auth.user }) }));
vi.mock('../../services/api', () => ({ default: http }));
import { InspectionActAccessPanel } from '../../pages/inspecciones/InspectionActAccessPanel';
import { readReplyDrafts } from '../../services/inspectionActDrafts';
import { inspectionContextKey, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';

const presentation = { id: 'pres-1', tipo: 'ACTA_PRESENTACION_RECIBIDA', createdAt: new Date().toISOString(), detalle: 'Consulta artificial.', metadata: { tipo: 'CONSULTA', nombre: 'Persona de práctica', accesoId: 'grant' } };
const inspection = (eventos: any[] = [presentation], id = 'case-1') => ({ id, datosActa: {}, eventos });
const reply = 'Respuesta artificial del equipo de inspección.';
const ctx = (user = auth.user, id = 'case-1') => inspectionContextKey(user.id, inspectionWorkspaceOwner(user), id);
function open(value = inspection()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InspectionActAccessPanel inspection={value} /></QueryClientProvider>);
}
const box = () => screen.getByLabelText('Respuesta al inspeccionado') as HTMLTextAreaElement;

beforeEach(() => {
  localStorage.clear(); auth.user = { id: 'insp-1', rol: 'ADMIN', esInspector: true };
  http.get.mockReset().mockResolvedValue({ data: { data: { envioHabilitado: false, motivo: 'EMAIL_DISABLED', correos: [
    { id: 'm1', eventoId: 'pres-1', audiencia: 'INSPECCIONADO', destinatario: 'persona@practica.sitrep.test', asunto: '[SITREP] Recibimos tu consulta sobre el acta QA-001', html: '<p>muestra</p>', estado: 'SUPRIMIDO', motivo: 'EMAIL_DISABLED' },
  ] } } });
  http.post.mockReset();
});
afterEach(() => cleanup());

describe('staff reply to a limited-link presentation', () => {
  it('recovers an unpublished reply after closing and reopening', async () => {
    const first = open(); fireEvent.change(box(), { target: { value: reply } }); first.unmount();
    open();
    expect(box().value).toBe(reply);
    expect(screen.getByText(/Respuesta recuperada sin publicar/)).toBeTruthy();
  });

  it('isolates replies by account and by dossier', async () => {
    const first = open(); fireEvent.change(box(), { target: { value: reply } }); first.unmount();
    auth.user = { id: 'insp-2', rol: 'ADMIN', esInspector: true };
    const second = open(); expect(box().value).toBe(''); second.unmount();
    auth.user = { id: 'insp-1', rol: 'ADMIN', esInspector: true };
    open(inspection([presentation], 'case-2')); expect(box().value).toBe('');
    expect(readReplyDrafts(ctx())['pres-1']?.texto).toBe(reply);
  });

  it('keeps the reply and its request id after a failure, replays it, and clears it only when confirmed', async () => {
    open(); fireEvent.change(box(), { target: { value: reply } });
    http.post.mockRejectedValueOnce(new Error('Network Error'));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta en el enlace' }));
    expect(await screen.findByText(/sigue guardado en este dispositivo/)).toBeTruthy();
    const stored = readReplyDrafts(ctx())['pres-1'];
    expect(stored.texto).toBe(reply); expect(stored.clienteId).toMatch(/^[0-9a-f-]{36}$/);
    cleanup(); open();
    http.post.mockResolvedValueOnce({ data: { data: { id: 'ans' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta en el enlace' }));
    await waitFor(() => expect(readReplyDrafts(ctx())['pres-1']).toBeUndefined());
    expect(http.post.mock.calls.map(c => c[1].clienteId)).toEqual([stored.clienteId, stored.clienteId]);
  });

  it('drops a stored reply that already appears published', () => {
    localStorage.setItem(`sitrep_acta_reply_draft_v1:${ctx()}`, JSON.stringify({ v: 1, replies: { 'pres-1': { texto: reply, clienteId: '', savedAt: new Date().toISOString() } } }));
    open(inspection([presentation, { id: 'ans', tipo: 'ACTA_PRESENTACION_RESPONDIDA', detalle: reply, metadata: { respondeAId: 'pres-1' }, createdAt: new Date().toISOString() }]));
    expect(screen.queryByLabelText('Respuesta al inspeccionado')).toBeNull();
    expect(readReplyDrafts(ctx())['pres-1']).toBeUndefined();
  });

  it('lists unanswered presentations first with a pending count', () => {
    const older = { ...presentation, id: 'pres-old', createdAt: '2026-11-01T10:00:00Z', detalle: 'Consulta antigua sin respuesta.' };
    const newer = { ...presentation, id: 'pres-new', createdAt: '2026-11-03T10:00:00Z', detalle: 'Consulta reciente ya respondida.' };
    open(inspection([newer, older, { id: 'ans', tipo: 'ACTA_PRESENTACION_RESPONDIDA', detalle: 'Respuesta.', metadata: { respondeAId: 'pres-new' }, createdAt: '2026-11-03T11:00:00Z' }]));
    expect(screen.getByText('1 presentación pendiente de respuesta · 1 respondidas')).toBeTruthy();
    const order = screen.getAllByText(/Consulta (antigua|reciente)/).map(node => node.textContent);
    expect(order).toEqual(['Consulta antigua sin respuesta.', 'Consulta reciente ya respondida.']);
    expect(screen.getByText('Presentaciones respondidas (1)')).toBeTruthy();
  });

  it('folds the follow-up form of an answered presentation', () => {
    open(inspection([presentation, { id: 'ans', tipo: 'ACTA_PRESENTACION_RESPONDIDA', detalle: 'Respuesta.', metadata: { respondeAId: 'pres-1' }, createdAt: new Date().toISOString() }]));
    expect(screen.queryByLabelText('Respuesta al inspeccionado')).toBeNull();
    fireEvent.click(screen.getByText('Presentaciones respondidas (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar otra respuesta' }));
    expect(box()).toBeTruthy();
  });

  it('shows what mail was prepared and that it was not sent', async () => {
    open();
    fireEvent.click(await screen.findByText('Avisos por correo (1)'));
    expect(screen.getByText('Preparado, no enviado: el envío de correos está desactivado')).toBeTruthy();
    expect(screen.getByText('Recibimos tu consulta sobre el acta QA-001')).toBeTruthy();
  });
});
