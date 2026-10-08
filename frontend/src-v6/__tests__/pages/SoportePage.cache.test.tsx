import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), team: vi.fn(), act: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'owner', nombre: 'QA', rol: 'OPERADOR' } }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: null }) }));
vi.mock('../../services/support.service', () => ({ supportService: calls, supportError: () => 'Error de prueba' }));
import SoportePage from '../../pages/soporte/SoportePage';
const subject = 'Problema de QR confirmado';
const filename = 'captura-' + 'a'.repeat(110) + '.png';
const ticket = { id: 'new-ticket', referencia: 'SOP-000001', asunto: subject, categoria: 'QR', estado: 'ABIERTO', autorId: 'owner', responsableId: null,
  tipo: null, prioridad: 'NORMAL', clasificadoAt: null, registradoPor: null,
  autor: { id: 'owner', nombre: 'QA' }, responsable: null, version: 1, createdAt: '2026-10-06T01:00:00Z', updatedAt: '2026-10-06T01:00:00Z',
  contexto: { ruta: '/soporte', ancho: 360, alto: 800 }, puedeGestionar: false, puedeAtender: false, esAutor: true,
  mensajes: [{ id: 'message', cuerpo: 'Descripción original del reporte', interno: false, autor: { id: 'owner', nombre: 'QA' }, createdAt: '2026-10-06T01:00:00Z',
    adjuntos: [{ id: 'file', nombre: filename, mime: 'image/png', bytes: 1200, sha256: 'unit-fixture' }] }], eventos: [] };
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('sitrep_access_token', 'unit.' + btoa(JSON.stringify({ id: 'owner' })) + '.not-a-credential');
  vi.clearAllMocks(); calls.access.mockResolvedValue({ puedeGestionar: false, puedeConfigurar: false });
  calls.list.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }); calls.get.mockResolvedValue(ticket);
  calls.create.mockImplementation(async () => {
    calls.list.mockResolvedValue({ items: [ticket], total: 1, page: 1, totalPages: 1 });
    return { id: ticket.id, referencia: ticket.referencia };
  });
});
it('refreshes the real owned list after a confirmed create even when its cache was fresh', async () => {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } });
  render(<QueryClientProvider client={query}><MemoryRouter initialEntries={['/soporte']}><Routes>
    <Route path="/soporte" element={<SoportePage />} /><Route path="/soporte/:id" element={<SoportePage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByText('0 tickets en esta vista');
  fireEvent.click(screen.getByRole('button', { name: 'Reportar problema', exact: true }));
  fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: subject } });
  fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer y qué ocurrió?'), { target: { value: 'El lector no responde después de abrirlo.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar ticket', exact: true }));
  const back = await screen.findByRole('link', { name: 'Volver a tickets', exact: true });
  expect(await screen.findByText('360 × 800')).toHaveClass('whitespace-nowrap');
  expect(screen.getByRole('button', { name: new RegExp(filename) })).toHaveClass('max-w-full', '[overflow-wrap:anywhere]');
  expect(screen.getByLabelText('Adjuntar captura o documento')).toHaveClass('file:min-h-11', 'file:border-neutral-400');
  fireEvent.click(back);
  expect(await screen.findByText('1 ticket en esta vista')).toBeVisible();
  const row = screen.getByRole('link', { name: new RegExp(subject) }); expect(row).toHaveAttribute('href', '/soporte/new-ticket');
  await waitFor(() => expect(calls.list.mock.calls.length).toBeGreaterThan(1));
  expect(calls.create).toHaveBeenCalledOnce();
});
it('distinguishes homonymous support agents and submits the selected account, not its display name', async () => {
  const agents = [{ id: 'first-agent', nombre: 'María Pérez', email: 'primera@qa.invalid' }, { id: 'second-agent', nombre: 'María Pérez', email: 'segunda@qa.invalid' }];
  calls.team.mockResolvedValue(agents); calls.act.mockResolvedValue({ id: ticket.id, version: 2, replay: false });
  calls.get.mockResolvedValue({ ...ticket, autorId: 'customer', responsableId: 'owner', responsable: { id: 'owner', nombre: 'QA' }, puedeGestionar: true, puedeAtender: true, esAutor: false });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><MemoryRouter initialEntries={['/soporte/new-ticket']}><Routes><Route path="/soporte/:id" element={<SoportePage />} /></Routes></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Derivar', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo responsable', exact: true }));
  expect(await screen.findByRole('option', { name: 'María Pérez · primera@qa.invalid', exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole('option', { name: 'María Pérez · segunda@qa.invalid', exact: true }));
  expect(screen.getByText('Responsable seleccionado: segunda@qa.invalid', { exact: true })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Nota interna / motivo'), { target: { value: 'Derivación al segundo responsable del turno.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar derivación', exact: true }));
  await waitFor(() => expect(calls.act).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ accion: 'DERIVAR', responsableId: 'second-agent' }), [], expect.any(String)));
});

function openDetail(overrides = {}) {
  calls.team.mockResolvedValue([{ id: 'second-agent', nombre: 'Técnica QA', email: 'tecnica@qa.invalid' }]);
  calls.get.mockResolvedValue({ ...ticket, autorId: 'customer', puedeGestionar: true, puedeAtender: true, esAutor: false, ...overrides });
  calls.act.mockResolvedValue({ id: ticket.id, version: 2, replay: false });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={query}><MemoryRouter initialEntries={['/soporte/new-ticket']}><Routes><Route path="/soporte/:id" element={<SoportePage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
it('classifies area, type and priority with an internal reason rather than closing the ticket', async () => {
  openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Clasificar', exact: true }));
  expect(screen.getByText('El motivo es interno. Clasificar no cierra el ticket.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tipo de ticket', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Problema técnico', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Prioridad', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Alta', exact: true }));
  fireEvent.change(screen.getByLabelText('Nota interna / motivo'), { target: { value: 'El escáner QR bloquea el trabajo de campo.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar clasificación', exact: true }));
  await waitFor(() => expect(calls.act).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ accion: 'CLASIFICAR', categoria: 'QR', tipo: 'PROBLEMA', prioridad: 'ALTA' }), [], expect.any(String)));
});
it('lets a common reporter read the response before the composer while keeping staff actions separate', async () => {
  openDetail({ autorId: 'owner', esAutor: true, puedeGestionar: false, puedeAtender: false });
  const conversation = await screen.findByRole('region', { name: 'Conversación', exact: true });
  const reply = screen.getByRole('region', { name: 'Atender ticket', exact: true });
  expect(conversation.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Las respuestas llegan a tus avisos' })).toHaveAttribute('href', '/notificaciones');
  expect(screen.queryByRole('button', { name: 'Clasificar', exact: true })).not.toBeInTheDocument();
});
it('explains and focuses an incomplete reply instead of silently disabling sending', async () => {
  openDetail();
  const submit = await screen.findByRole('button', { name: 'Enviar respuesta', exact: true });
  expect(submit).toBeEnabled(); fireEvent.click(submit);
  expect(screen.getByRole('alert')).toHaveTextContent('Escribí un mensaje o una resolución.');
  expect(screen.getByLabelText('Mensaje o resolución')).toHaveFocus(); expect(calls.act).not.toHaveBeenCalled();
});
it('puts named support controls before the conversation, without an action dropdown', async () => {
  openDetail();
  const actions = await screen.findByRole('region', { name: 'Atender ticket', exact: true });
  for (const label of ['Responder', 'Nota interna', 'Derivar', 'Pedir respuesta', 'Cerrar']) expect(within(actions).getByRole('button', { name: label, exact: true })).toBeVisible();
  expect(actions.compareDocumentPosition(screen.getByRole('region', { name: 'Conversación', exact: true })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Acción de soporte', exact: true })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Soporte de SITREP', exact: true })).queryByRole('button', { name: 'Reportar problema', exact: true })).not.toBeInTheDocument();
});
it('makes a private note explicit and sends the actual note action without attachments', async () => {
  openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Nota interna', exact: true }));
  expect(screen.getByText('Sólo el equipo de soporte puede leer esta nota.', { exact: true })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Nota interna / motivo'), { target: { value: 'Diagnóstico reservado del equipo.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nota interna', exact: true }));
  await waitFor(() => expect(calls.act).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ accion: 'NOTA', cuerpo: 'Diagnóstico reservado del equipo.' }), [], expect.any(String)));
});
it('does not attach a previously selected reply file to a handoff action', async () => {
  openDetail();
  const input = await screen.findByLabelText('Adjuntar captura o documento');
  fireEvent.change(input, { target: { files: [new File(['synthetic'], 'respuesta.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Derivar', exact: true }));
  expect(input).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo responsable', exact: true }));
  fireEvent.click(await screen.findByRole('option', { name: 'Técnica QA · tecnica@qa.invalid', exact: true }));
  fireEvent.change(screen.getByLabelText('Nota interna / motivo'), { target: { value: 'Derivar al equipo de la tarde.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar derivación', exact: true }));
  await waitFor(() => expect(calls.act).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ accion: 'DERIVAR', responsableId: 'second-agent' }), [], expect.any(String)));
});
it('does not expose internal notes or handoff actions to a common reporter', async () => {
  openDetail({ autorId: 'owner', puedeGestionar: false, puedeAtender: false, esAutor: true });
  await screen.findByRole('button', { name: 'Responder', exact: true });
  for (const label of ['Nota interna', 'Derivar', 'Pedir respuesta', 'Tomar ticket']) expect(screen.queryByRole('button', { name: label, exact: true })).not.toBeInTheDocument();
  expect(screen.getByText('Este mensaje queda visible en la conversación del ticket.', { exact: true })).toBeVisible();
  expect(calls.team).not.toHaveBeenCalled();
});
it('explains when no other active teammate is available rather than showing an empty handoff', async () => {
  openDetail({ responsableId: 'second-agent' }); calls.team.mockResolvedValue([{ id: 'second-agent', nombre: 'Técnica QA', email: 'tecnica@qa.invalid' }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Derivar', exact: true }));
  expect(await screen.findByText('No hay otro responsable activo. Un administrador puede configurar el Equipo de soporte desde la mesa.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirmar derivación', exact: true })).toBeDisabled();
});
it('offers assignment and direct routing for unassigned staff without opening response permissions', async () => {
  openDetail({ puedeAtender: false });
  expect(await screen.findByRole('button', { name: 'Asignarme', exact: true })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Derivar', exact: true })).toBeVisible();
  for (const label of ['Responder', 'Nota interna']) expect(screen.queryByRole('button', { name: label, exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Asignarme', exact: true }));
  await waitFor(() => expect(calls.act).toHaveBeenCalledWith(ticket.id, { accion: 'TOMAR', cuerpo: '', version: 1 }, [], expect.any(String)));
});
