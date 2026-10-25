import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ query: {} as any }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.query }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-owner', rol: 'GENERADOR' } }) }));
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
