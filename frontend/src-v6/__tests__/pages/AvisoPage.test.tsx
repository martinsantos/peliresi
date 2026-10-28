import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ query: {} as any, user: { id: 'qa-owner', rol: 'GENERADOR', actividades: ['GENERADOR', 'OPERADOR'] } as any, activate: vi.fn(), invalidate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.query, useQueryClient: () => ({ invalidateQueries: state.invalidate }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user }) }));
vi.mock('../../services/activateActorActivity', () => ({ activateActorActivity: state.activate }));
import AvisoPage from '../../pages/notificaciones/AvisoPage';
import { notificationInboxReturnState } from '../../utils/notificationNavigation';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
beforeEach(() => { state.user = { id: 'qa-owner', rol: 'GENERADOR', actividades: ['GENERADOR', 'OPERADOR'] }; state.activate.mockReset(); state.invalidate.mockReset(); state.query = { isPending: false, isError: false, refetch: vi.fn(), data: { id: 'n1', tipo: 'MODIFICACION_RECHAZADA', titulo: 'Renovación rechazada', mensaje: 'QA empresa · Período 2027. Motivo: falta constancia.', datos: '{"renovacionId":"r1"}', createdAt: '2026-10-25' } }; });
afterEach(cleanup);
function show(prefix = '', entryState?: unknown) {
 return render(<MemoryRouter basename={prefix || '/'} initialEntries={[{ pathname: prefix + '/notificaciones/n1', state: entryState }]}><Routes><Route path="/notificaciones/:id" element={<AvisoPage />} /></Routes></MemoryRouter>);
}
it.each(['', '/app'])('keeps the original GPS notice and explains its temporal uncertainty on %s', prefix => {
 state.query.data = { ...state.query.data, tipo: 'ANOMALIA_DETECTADA', titulo: 'Anomalía GPS', mensaje: 'Parada prolongada de 120 minutos', datos: null, manifiesto: { numero: 'QA-001', estado: 'EN_TRANSITO' } };
 show(prefix);
 expect(screen.getByText('Parada prolongada de 120 minutos')).toBeVisible();
 expect(screen.getByText(/hora de captura.*recepci[oó]n/i)).toBeVisible();
 expect(screen.getByText('Manifiesto QA-001')).toBeVisible();
});
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
it('restores only the inbox filters belonging to the current activity', () => {
 const entry = notificationInboxReturnState('?avisos=sin-leer&pagina=2', inspectionWorkspaceOwner(state.user));
 const view = show('/app', entry);
 expect(screen.getByRole('link', { name: 'Volver a Avisos' })).toHaveAttribute('href', '/app/notificaciones?avisos=sin-leer&pagina=2');
 view.unmount();
 state.user = { ...state.user, rol: 'OPERADOR' };
 show('/app', entry);
 expect(screen.getByRole('link', { name: 'Volver a Avisos' })).toHaveAttribute('href', '/app/notificaciones');
});

it.each(['', '/app'])('guides a different activity in %s and preserves the current role if validation fails', async prefix => {
 state.query.data = { ...state.query.data, tipo: 'INFO_GENERAL', titulo: 'PSIP · Nuevo requerimiento', datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-operator', destino: 'participacion', tipoActor: 'OPERADOR' }) };
 state.activate.mockRejectedValue(new Error('Revoked'));
 show(prefix);
 expect(screen.getByText('Usá tu actividad Operador para consultar este requerimiento.')).toBeVisible();
 expect(screen.queryByText('Actividad: Operador')).toBeNull();
 expect(screen.queryByRole('link', { name: 'Consultar requerimiento y estado →' })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Usar Operador y abrir requerimiento' }));
 await waitFor(() => expect(state.activate).toHaveBeenCalledWith('qa-owner', 'OPERADOR'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu actividad actual no cambió');
});
it.each(['', '/app'])('does not open a certificate for the wrong activity or actor in %s', async prefix => {
 state.query.data = { ...state.query.data, titulo: 'Certificado ambiental disponible', datos: JSON.stringify({ tipo: 'certificado_ambiental', actorTipo: 'operador', actorId: 'operator-1', documentoId: 'doc-1' }) };
 state.user = { ...state.user, rol: 'OPERADOR', actorId: 'other', empresaContexto: { todasSedes: true } };
 state.activate.mockRejectedValue(new Error('Revoked'));
 show(prefix);
 expect(screen.getByText('Usá tu actividad Operador para consultar este certificado ambiental.')).toBeVisible();
 expect(screen.queryByRole('link', { name: 'Ver certificado ambiental →' })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Usar Operador y ver certificado' }));
 await waitFor(() => expect(state.activate).toHaveBeenCalledWith('qa-owner', 'OPERADOR', 'operator-1'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu actividad actual no cambió');
});
it.each(['', '/app'])('opens the exact certificate when the authorized activity and actor match in %s', prefix => {
 state.query.data = { ...state.query.data, titulo: 'Certificado ambiental disponible', datos: JSON.stringify({ tipo: 'certificado_ambiental', actorTipo: 'operador', actorId: 'operator-1', documentoId: 'doc-1' }) };
 state.user = { ...state.user, rol: 'OPERADOR', actorId: 'operator-1' };
 show(prefix);
 expect(screen.getByRole('link', { name: 'Ver certificado ambiental →' })).toHaveAttribute('href', prefix + '/mi-perfil?certificadoAmbiental=doc-1#certificado-ambiental');
});
it('does not offer the company certificate when site access is restricted', () => {
 state.query.data = { ...state.query.data, titulo: 'Certificado ambiental disponible', datos: JSON.stringify({ tipo: 'certificado_ambiental', actorTipo: 'operador', actorId: 'operator-1', documentoId: 'doc-1' }) };
 state.user = { ...state.user, rol: 'OPERADOR', actorId: 'operator-1', empresaContexto: { todasSedes: false } };
 show();
 expect(screen.queryByRole('link', { name: 'Ver certificado ambiental →' })).toBeNull();
 expect(screen.getByRole('button', { name: 'Usar Operador y ver certificado' })).toBeVisible();
});
it.each(['', '/app'])('requires the exact generator activity for a fiscal reminder in %s', async prefix => {
 state.query.data = { ...state.query.data, titulo: 'Recordatorio fiscal 2026', datos: JSON.stringify({ tipo: 'recordatorio_fiscal', generadorId: 'g-1', fiscalYear: 2026, url: '/perfil' }) };
 state.user = { ...state.user, rol: 'OPERADOR', actorId: 'o-1' };
 state.activate.mockRejectedValue(new Error('Revoked'));
 show(prefix);
 expect(screen.getByText('Usá tu actividad Generador para consultar este recordatorio fiscal.')).toBeVisible();
 expect(screen.queryByRole('link', { name: 'Ver situación fiscal →' })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Usar Generador' }));
 await waitFor(() => expect(state.activate).toHaveBeenCalledWith('qa-owner', 'GENERADOR', 'g-1'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Tu actividad actual no cambió');
});
it.each(['', '/app'])('opens the selected fiscal year and refreshes the actor data in %s', prefix => {
 state.query.data = { ...state.query.data, titulo: 'Recordatorio fiscal 2026', datos: JSON.stringify({ tipo: 'recordatorio_fiscal', generadorId: 'g-1', fiscalYear: 2026 }) };
 state.user = { ...state.user, rol: 'GENERADOR', actorId: 'g-1' };
 show(prefix);
 const link = screen.getByRole('link', { name: 'Ver situación fiscal →' });
 expect(link).toHaveAttribute('href', prefix + '/admin/actores/generadores/g-1?tab=fiscal&ejercicio=2026');
 fireEvent.click(link);
 expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ['generador-pagos', 'g-1'] });
 expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ['generador-ddjj', 'g-1'] });
});
it('keeps a restricted company context away from company-wide fiscal data', () => {
 state.query.data = { ...state.query.data, titulo: 'Recordatorio fiscal 2026', datos: JSON.stringify({ tipo: 'recordatorio_fiscal', generadorId: 'g-1', fiscalYear: 2026 }) };
 state.user = { ...state.user, rol: 'GENERADOR', actorId: 'g-1', empresaContexto: { todasSedes: false } };
 show();
 expect(screen.queryByRole('link', { name: 'Ver situación fiscal →' })).toBeNull();
 expect(screen.getByRole('button', { name: 'Usar Generador' })).toBeVisible();
});
it.each(['', '/app'])('shows company authorization instead of asking a representative for a personal role in %s', prefix => {
 state.query.data = { ...state.query.data, titulo: 'Recordatorio fiscal 2026', datos: JSON.stringify({ tipo: 'recordatorio_fiscal', version: 1,
  destino: 'representante', generadorId: 'g-1', fiscalYear: 2026,
  accesosEmpresa: [{ empresaId:'co', actividadId:'a', rol:'GENERADOR', razonSocial:'Empresa QA' }] }) };
 state.user = { ...state.user, rol: 'OPERADOR', actorId: 'o-1', actividades: ['OPERADOR'] };
 show(prefix);
 expect(screen.getByText('Empresa QA')).toBeVisible();
 expect(screen.getByRole('button', { name:'Usar Generador para continuar' })).toBeVisible();
 expect(screen.queryByText('Usá tu actividad Generador para consultar este recordatorio fiscal.')).toBeNull();
});
