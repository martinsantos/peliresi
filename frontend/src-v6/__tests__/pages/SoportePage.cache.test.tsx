import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  autor: { id: 'owner', nombre: 'QA' }, responsable: null, version: 1, createdAt: '2026-10-06T01:00:00Z', updatedAt: '2026-10-06T01:00:00Z',
  contexto: { ruta: '/soporte', ancho: 360, alto: 800 }, puedeGestionar: false, puedeAtender: false, esAutor: true,
  mensajes: [{ id: 'message', cuerpo: 'Descripción original del reporte', interno: false, autor: { id: 'owner', nombre: 'QA' }, createdAt: '2026-10-06T01:00:00Z',
    adjuntos: [{ id: 'file', nombre: filename, mime: 'image/png', bytes: 1200, sha256: 'unit-fixture' }] }], eventos: [] };
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); calls.access.mockResolvedValue({ puedeGestionar: false, puedeConfigurar: false });
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
  fireEvent.click(await screen.findByRole('button', { name: 'Acción de soporte', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Derivar a otro responsable', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo responsable', exact: true }));
  expect(await screen.findByRole('option', { name: 'María Pérez · primera@qa.invalid', exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole('option', { name: 'María Pérez · segunda@qa.invalid', exact: true }));
  expect(screen.getByText('Responsable seleccionado: segunda@qa.invalid', { exact: true })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Nota interna / motivo'), { target: { value: 'Derivación al segundo responsable del turno.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar acción', exact: true }));
  await waitFor(() => expect(calls.act).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ accion: 'DERIVAR', responsableId: 'second-agent' }), [], expect.any(String)));
});
