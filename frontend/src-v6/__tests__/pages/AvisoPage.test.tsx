import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ query: {} as any, user: { id: 'qa-owner', rol: 'GENERADOR', actividades: ['GENERADOR', 'OPERADOR'] } as any, activate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.query }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user }) }));
vi.mock('../../services/activateActorActivity', () => ({ activateActorActivity: state.activate }));
import AvisoPage from '../../pages/notificaciones/AvisoPage';
beforeEach(() => { state.query = { isPending: false, isError: false, refetch: vi.fn(), data: { id: 'n1', tipo: 'MODIFICACION_RECHAZADA', titulo: 'Renovación rechazada', mensaje: 'QA empresa · Período 2027. Motivo: falta constancia.', datos: '{"renovacionId":"r1"}', createdAt: '2026-10-25' } }; });
afterEach(cleanup);
function show(prefix = '') {
 return render(<MemoryRouter basename={prefix || '/'} initialEntries={[prefix + '/notificaciones/n1']}><Routes><Route path="/notificaciones/:id" element={<AvisoPage />} /></Routes></MemoryRouter>);
}
it.each(['', '/app'])('shows the complete result without a link to itself in %s', prefix => {
 show(prefix); expect(screen.getByText(/QA empresa · Período 2027/)).toBeVisible();
 expect(screen.queryByRole('link', { name: 'Ver aviso y resultado →' })).toBeNull();
 expect(screen.getByRole('link', { name: 'Volver a Avisos' })).toHaveAttribute('href', prefix + '/notificaciones');
 expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
});
it('hides cached private content after a failed fresh read and offers retry', () => {
 state.query.isError = true; show();
 expect(screen.queryByText(/QA empresa/)).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
 expect(state.query.refetch).toHaveBeenCalledOnce();
});

it.each(['', '/app'])('guides a different activity in %s and preserves the current role if validation fails', async prefix => {
 state.query.data = { ...state.query.data, tipo: 'INFO_GENERAL', titulo: 'PSIP · Nuevo requerimiento', datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-operator', destino: 'participacion', tipoActor: 'OPERADOR' }) };
 state.activate.mockRejectedValue(new Error('Revoked'));
 show(prefix);
 expect(screen.getByText('Usá tu actividad Operador para responder este requerimiento.')).toBeVisible();
 expect(screen.queryByText('Actividad: Operador')).toBeNull();
 expect(screen.queryByRole('link', { name: 'Ver requerimiento y responder →' })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Usar Operador y abrir requerimiento' }));
 await waitFor(() => expect(state.activate).toHaveBeenCalledWith('qa-owner', 'OPERADOR'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu actividad actual no cambió');
});
