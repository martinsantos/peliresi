import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AlertasPage from '../../pages/alertas/AlertasPage';
const service = vi.hoisted(() => ({ listAlertas: vi.fn(), listReglas: vi.fn(), resolverAlerta: vi.fn(), createRegla: vi.fn(), updateRegla: vi.fn(), deleteRegla: vi.fn(), evaluarSeguimiento: vi.fn(), simularSeguimiento: vi.fn(), evaluarCatalogo: vi.fn(), simularCatalogo: vi.fn() }));
const auth = vi.hoisted(() => ({ isAdmin: true, isAnyAdmin: true }));
const notices = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../services/alerta.service', () => ({ alertaService: service }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ ...auth, currentUser: { id: 'qa-alert-reader', rol: auth.isAdmin ? 'ADMIN' : 'GENERADOR', actorId: 'qa-actor' }, isRestricted: false }) }));
vi.mock('../../services/notificacion.service', () => ({ notificacionService: notices }));
const caseRow = { id: 'case', estado: 'PENDIENTE', createdAt: new Date().toISOString(), manifiestoId: 'manifest', manifiesto: { numero: 'QA-001', estado: 'RECIBIDO' }, regla: { nombre: 'Seguimiento de manifiesto', evento: 'TIEMPO_EXCESIVO' }, datos: '{"descripcion":"Recepción registrada; revisar el tratamiento"}' };
function setup() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter><AlertasPage /></MemoryRouter></QueryClientProvider>);
}
it('does not disguise failed rule loading as zero configured rules', async () => {
  service.listReglas.mockRejectedValue(new Error('offline')); setup();
  fireEvent.click(screen.getByRole('tab', { name: /Reglas/ }));
  expect(await screen.findByText('No se puede confirmar la configuración. No equivale a cero reglas.')).toBeVisible();
  expect(screen.queryByText('0 reglas configuradas')).toBeNull();
  expect(screen.getByRole('button', { name: 'Reintentar reglas' })).toBeVisible();
});
it('inspection rule is initially inactive, has exact recipients, no invented days and no external emails', async () => {
  setup(); fireEvent.click(screen.getByRole('tab', { name: /Reglas/ })); fireEvent.click(screen.getByRole('button', { name: 'Nueva Regla', exact: true }));
  const dialog = screen.getByRole('dialog', { name: 'Nueva Regla', exact: true });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tipo de regla', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Inspección · requerimiento sin respuesta', exact: true }));
  expect(within(dialog).getByLabelText('Regla activa')).not.toBeChecked();
  expect(within(dialog).getByText('INSPECCIONADO', { exact: true })).toBeVisible();
  expect(within(dialog).getByText('INSPECTOR_ASIGNADO', { exact: true })).toBeVisible();
  expect(within(dialog).queryByLabelText('Días desde la recepción')).toBeNull();
  expect(within(dialog).queryByText('Emails adicionales')).toBeNull();
});
it('asks for a duration threshold explicitly and preserves the form if the server rejects it', async () => {
  service.createRegla.mockRejectedValueOnce({ response: { data: { message: 'Indicá un umbral mínimo de horas de tránsito para activar esta regla.' } } });
  service.createRegla.mockResolvedValueOnce({ id: 'qa-duration', activa: true });
  setup(); fireEvent.click(screen.getByRole('tab', { name: /Reglas/ })); fireEvent.click(screen.getByRole('button', { name: 'Nueva Regla', exact: true }));
  const dialog = screen.getByRole('dialog', { name: 'Nueva Regla', exact: true });
  fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'QA duración' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Evento', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Duración del viaje', exact: true }));
  const hours = within(dialog).getByLabelText('Avisar a partir de (horas)');
  expect(hours).toHaveValue(null);
  expect(within(dialog).getByText(/no un plazo obligatorio del viaje/i)).toBeVisible();
  expect(within(dialog).getByText(/aproximadamente cada cinco minutos mientras el servicio funciona/i)).toBeVisible();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /ADMIN Administración central/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Crear regla', exact: true }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Indicá un umbral mínimo');
  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveFocus());
  expect(within(dialog).getByLabelText('Nombre')).toHaveValue('QA duración');
  fireEvent.change(hours, { target: { value: '36' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Crear regla', exact: true }));
  await waitFor(() => expect(service.createRegla).toHaveBeenLastCalledWith(expect.objectContaining({ condicion: '{"horasTransito":{"gte":36}}' })));
});
it('identifies a historical duration rule that needs a threshold', async () => {
  service.listReglas.mockResolvedValue([{ id: 'legacy', nombre: 'QA sin umbral', evento: 'TIEMPO_EXCESIVO', activa: true,
    condicion: '{}', destinatarios: '["ADMIN"]', requiereUmbralTransito: true }]);
  setup(); fireEvent.click(screen.getByRole('tab', { name: /Reglas/ }));
  expect((await screen.findAllByText('Falta configurar un umbral de tránsito.')).length).toBeGreaterThan(0);
});
it('does not present the legacy route-deviation rule as a working authorised route check', async () => {
  service.listReglas.mockResolvedValue([{ id: 'legacy-route', nombre: 'QA ruta', evento: 'DESVIO_RUTA', activa: true,
    condicion: '{"distanciaKm":{"gt":50}}', destinatarios: '["ADMIN"]' }]);
  setup(); fireEvent.click(screen.getByRole('tab', { name: /Reglas/ }));
  expect((await screen.findAllByText(/seguimiento GPS actual no activa esta regla/i)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Nueva Regla', exact: true }));
  const dialog = screen.getByRole('dialog', { name: 'Nueva Regla', exact: true });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Evento', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Desvío de Ruta', exact: true }));
  expect(within(dialog).getByText(/seguimiento GPS actual no activa esta regla/i)).toBeVisible();
  expect(within(dialog).queryByText(/corredor autorizado/i)).toBeNull();
});
it('names rule families consistently without confusing inspection or treatment follow-up with travel duration', async () => {
  service.listReglas.mockResolvedValue([
    { id: 'duration', nombre: 'QA viaje', evento: 'TIEMPO_EXCESIVO', condicion: '{"horasTransito":{"gte":36}}', destinatarios: '[]' },
    { id: 'followup', nombre: 'QA tratamiento', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":7}}', destinatarios: '[]' },
    { id: 'inspection', nombre: 'QA inspección', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"requerimiento_inspeccion"}', destinatarios: '[]' },
  ]);
  setup(); fireEvent.click(screen.getByRole('tab', { name: /Reglas/ }));
  expect((await screen.findAllByText('Duración del viaje')).length).toBe(2);
  expect(screen.getAllByText('Seguimiento de tratamiento')).toHaveLength(2);
  expect(screen.getAllByText('Requerimiento de inspección')).toHaveLength(2);
  expect(screen.queryByText('TIEMPO_EXCESIVO')).toBeNull();
});
beforeEach(() => {
  vi.clearAllMocks(); auth.isAdmin = true; auth.isAnyAdmin = true;
  notices.list.mockResolvedValue({ items: [], total: 0 });
  service.listAlertas.mockResolvedValue({ items: [caseRow], total: 110, page: 1, limit: 10, totalPages: 11 });
  service.listReglas.mockResolvedValue([]); service.resolverAlerta.mockResolvedValue({ ...caseRow, estado: 'RESUELTA' });
});
it('keeps a historical GPS case and shows the uncertainty of its original description', async () => {
  service.listAlertas.mockResolvedValue({ items: [{ ...caseRow, regla: { nombre: 'QA GPS', evento: 'ANOMALIA_GPS' },
    datos: JSON.stringify({ tipoAnomalia: 'PARADA_PROLONGADA', descripcion: 'Parada prolongada de 120 minutos' }) }],
    total: 1, page: 1, limit: 10, totalPages: 1 });
  setup();
  expect(await screen.findByText(/hora de captura.*recepci[oó]n/i)).toBeVisible();
  expect(screen.getByText('Parada prolongada de 120 minutos')).toBeVisible();
});
it('keeps a historical corridor case and explains that its positions may have arrived late', async () => {
  service.listAlertas.mockResolvedValue({ items: [{ ...caseRow, regla: { nombre: 'QA corredor', evento: 'ANOMALIA_GPS' },
    datos: JSON.stringify({ tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO', descripcion: 'Tres posiciones consecutivas se mantuvieron fuera del corredor estimado' }) }],
    total: 1, page: 1, limit: 10, totalPages: 1 });
  setup();
  expect(await screen.findByText(/hora de captura.*recepci[oó]n/i)).toBeVisible();
  expect(screen.getByText('Tres posiciones consecutivas se mantuvieron fuera del corredor estimado')).toBeVisible();
});
it('keeps the actor alert unread badge readable without inventing a global count', async () => {
  auth.isAdmin = false; auth.isAnyAdmin = false;
  notices.list.mockResolvedValue({ items: [{ id: 'qa-unread', titulo: 'Visita asignada', mensaje: 'QA aviso interno', leida: false, tipo: 'INFO_GENERAL', createdAt: new Date().toISOString() }], total: 1 });
  setup();
  expect(await screen.findByText('1 sin leer en esta lista', { exact: true })).toBeVisible();
  expect(screen.getByText('1', { exact: true })).toHaveClass('bg-error-700', 'text-white');
  expect(service.listAlertas).not.toHaveBeenCalled();
});
it('uses actual server pagination and exposes case state, not a fake read badge', async () => {
  setup(); expect(await screen.findByText('110 casos')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Marcar todas', exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Limpiar', exact: true })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente página de alertas' }));
  await waitFor(() => expect(service.listAlertas).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })));
});
it('requires a deliberate state and reason and keeps the case after failed persistence', async () => {
  service.resolverAlerta.mockRejectedValue(new Error('offline'));
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Gestionar caso', exact: true }));
  const dialog = screen.getByRole('dialog', { name: 'Gestionar caso', exact: true });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar estado', exact: true }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Registrá el motivo'); expect(service.resolverAlerta).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText('Motivo del cambio'), { target: { value: 'Revisar evidencia' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar estado', exact: true }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo guardar');
  expect(service.resolverAlerta).toHaveBeenCalledWith('case', 'Revisar evidencia', 'PENDIENTE');
  expect(screen.getByRole('article')).toHaveTextContent('Pendiente'); expect(dialog).toBeVisible();
});
it('does not present an API failure as an empty repository', async () => {
  service.listAlertas.mockRejectedValue(new Error('offline')); setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar');
  expect(screen.queryByText('No hay alertas para los filtros seleccionados')).toBeNull();
});
it('shows the persisted decision reason on a resolved case without fading its readable content', async () => {
  service.listAlertas.mockResolvedValue({ items: [{ ...caseRow, estado: 'RESUELTA', notas: 'Inspección confirmó cierre de tarea', fechaResolucion: '2026-10-04T12:00:00Z' }], total: 1, page: 1, limit: 10, totalPages: 1 });
  setup();
  expect(await screen.findByText(/Inspección confirmó cierre de tarea/)).toBeVisible();
  expect(screen.getByRole('article').className).not.toContain('opacity-60');
});
it('sector administrators have no rule-write or evaluation controls', async () => {
  auth.isAdmin = false; setup(); await screen.findByRole('button', { name: 'Gestionar caso' });
  expect(screen.queryByRole('button', { name: 'Evaluar seguimiento ahora' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Reglas/ }));
  expect(screen.queryByRole('button', { name: 'Nueva Regla' })).toBeNull();
});
it('actors do not query administrative rules and cannot resolve global cases', async () => {
  auth.isAdmin = false; auth.isAnyAdmin = false; setup(); await screen.findByText('No hay alertas para los filtros seleccionados');
  expect(service.listReglas).not.toHaveBeenCalled(); expect(service.listAlertas).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Gestionar caso' })).toBeNull();
});
it('selects the shared rule button, simulates without saving, and creates follow-up inactive', async () => {
  service.simularSeguimiento.mockResolvedValue({ total: 1, ejemplos: [], evaluadoAt: '2026-10-04T12:00:00Z', escribeDatos: false, canal: 'interno' });
  service.createRegla.mockResolvedValue({ id: 'qa-rule', activa: false });
  setup(); await screen.findByRole('button', { name: 'Gestionar caso' });
  fireEvent.click(screen.getByRole('tab', { name: /Reglas/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Nueva Regla' }));
  const dialog = screen.getByRole('dialog', { name: 'Nueva Regla' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tipo de regla', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: 'Manifiesto pendiente de tratamiento o cierre', exact: true }));
  expect(within(dialog).getByLabelText('Regla activa')).not.toBeChecked();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Simular sin enviar' }));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Sin crear casos ni avisos');
  expect(service.simularSeguimiento).toHaveBeenCalledWith(0);
  expect(service.createRegla).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Crear regla' }));
  await waitFor(() => expect(service.createRegla).toHaveBeenCalledWith(expect.objectContaining({ activa: false, destinatarios: '["OPERADOR"]' })));
});
