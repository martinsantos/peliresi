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
const ticket = { id: 'new-ticket', referencia: 'SOP-000001', asunto: subject, categoria: 'QR', estado: 'ABIERTO', autorId: 'owner', responsableId: null,
  autor: { id: 'owner', nombre: 'QA' }, responsable: null, version: 1, createdAt: '2026-10-06T01:00:00Z', updatedAt: '2026-10-06T01:00:00Z',
  contexto: { ruta: '/soporte' }, puedeGestionar: false, puedeAtender: false, esAutor: true, mensajes: [], eventos: [] };
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
  fireEvent.click(back);
  expect(await screen.findByText('1 tickets en esta vista')).toBeVisible();
  const row = screen.getByRole('link', { name: new RegExp(subject) }); expect(row).toHaveAttribute('href', '/soporte/new-ticket');
  await waitFor(() => expect(calls.list.mock.calls.length).toBeGreaterThan(1));
  expect(calls.create).toHaveBeenCalledOnce();
});
