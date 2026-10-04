import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AlertasPage from '../../pages/alertas/AlertasPage';
const service = vi.hoisted(() => ({ listAlertas: vi.fn(), listReglas: vi.fn(), resolverAlerta: vi.fn(), createRegla: vi.fn(), updateRegla: vi.fn(), deleteRegla: vi.fn(), evaluarSeguimiento: vi.fn(), simularSeguimiento: vi.fn(), evaluarCatalogo: vi.fn(), simularCatalogo: vi.fn() }));
const auth = vi.hoisted(() => ({ isAdmin: true, isAnyAdmin: true }));
vi.mock('../../services/alerta.service', () => ({ alertaService: service }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/notificacion.service', () => ({ notificacionService: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }) } }));
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
beforeEach(() => {
  vi.clearAllMocks(); auth.isAdmin = true; auth.isAnyAdmin = true;
  service.listAlertas.mockResolvedValue({ items: [caseRow], total: 110, page: 1, limit: 10, totalPages: 11 });
  service.listReglas.mockResolvedValue([]); service.resolverAlerta.mockResolvedValue({ ...caseRow, estado: 'RESUELTA' });
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
