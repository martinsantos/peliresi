import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GeneradorDetallePage from '../../pages/admin/GeneradorDetallePage';

const queries = vi.hoisted(() => ({ pagos: vi.fn(), ddjj: vi.fn(), documentos: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'admin-qa', rol: 'ADMIN' } }) }));
vi.mock('../../hooks/useActores', () => ({ useGenerador: () => ({ data: {
  id: 'g-qa', razonSocial: 'Generador QA', cuit: '99-00000001-0', activo: true,
  categoria: 'PEQUENO_GENERADOR', createdAt: '2026-10-01T12:00:00.000Z', corrientesControl: 'Y1',
}, isLoading: false }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useGeneradoresEnrichment: () => ({ data: {} }) }));
vi.mock('../../components/ActorCertificates', () => ({ default: () => <input aria-label="Borrador del certificado" /> }));
vi.mock('../../components/AdministrativeTEF', () => ({ AdministrativeTEF: () => null }));
vi.mock('../../components/TrazabilidadTimeline', () => ({ default: () => null }));
vi.mock('../../components/HistorialCambiosActor', () => ({ default: () => null }));
vi.mock('../../pages/inspecciones/ActorInspectionsPanel', () => ({ ActorInspectionsPanel: () => null }));
vi.mock('../../services/generador-fiscal.service', () => ({ generadorFiscalService: {
  getPagos: queries.pagos, getDDJJ: queries.ddjj, getDocumentos: queries.documentos,
}, documentoIdentityService: {} }));

function ReturnProbe() {
  const location = useLocation();
  return <div data-testid="notice-return">{JSON.stringify(location.state)}</div>;
}
function open(tab = 'info', extra = '', state?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: '/admin/actores/generadores/g-qa', search: '?tab=' + tab + extra, state }]}>
    <Routes><Route path="/admin/actores/generadores/:id" element={<GeneradorDetallePage />} /><Route path="/notificaciones/:id" element={<ReturnProbe />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
  return client;
}

describe('Generator fiscal reads never present a failure as an empty or noncompliant record', () => {
  beforeEach(() => {
    queries.pagos.mockReset().mockResolvedValue([]);
    queries.ddjj.mockReset().mockResolvedValue([]);
    queries.documentos.mockReset().mockResolvedValue([]);
  });

  it('does not infer unpaid or unqualified while the payment query is still pending', () => {
    queries.pagos.mockReturnValue(new Promise(() => {}));
    open();
    const summary = screen.getByRole('region', { name: 'Resumen del generador' });
    expect(within(summary).getByRole('status')).toHaveTextContent('Cargando situación fiscal');
    expect(within(summary).queryByText('Pendiente')).toBeNull();
    expect(within(summary).queryByText('No', { exact: true })).toBeNull();
  });

  it('offers a payment retry in the overview and restores the actual values', async () => {
    queries.pagos.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([
      { id: 'p-qa', anio: new Date().getFullYear(), fechaPago: '2026-01-01T00:00:00.000Z', habilitado: true, montoTEF: 100 },
    ]);
    open();
    const summary = screen.getByRole('region', { name: 'Resumen del generador' });
    expect(await within(summary).findByRole('alert')).toHaveTextContent('No pudimos consultar la situación fiscal');
    expect(within(summary).queryByText('Pendiente')).toBeNull();
    fireEvent.click(within(summary).getByRole('button', { name: 'Reintentar situación fiscal' }));
    await waitFor(() => expect(within(summary).getByText('Al día')).toBeVisible());
    expect(within(summary).getByText('Sí')).toBeVisible();
    expect(queries.pagos).toHaveBeenCalledTimes(2);
  });

  it('hides fiscal totals and empty messages after a failed refresh, even with cached records', async () => {
    queries.pagos.mockResolvedValueOnce([{ id: 'p-qa', anio: 2026, montoTEF: 100, fechaPago: null }]).mockRejectedValue(new Error('offline'));
    const client = open('fiscal');
    const panel = await screen.findByRole('tabpanel', { name: 'Situación fiscal' });
    await within(panel).findAllByText('$ 100');
    await client.invalidateQueries({ queryKey: ['generador-pagos', 'g-qa'] });
    expect(await within(panel).findByRole('alert')).toHaveTextContent('No pudimos consultar la situación fiscal');
    expect(within(panel).queryByText('$ 100')).toBeNull();
    expect(within(panel).queryByText('Sin pagos registrados')).toBeNull();
  });

  it('distinguishes an actual empty payment response from an unavailable response', async () => {
    open('fiscal');
    expect(await screen.findByText('Sin pagos registrados')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('orients the selected year without inventing a payment', async () => {
    open('fiscal', '&ejercicio=2026');
    expect(await screen.findByText(/No hay pagos registrados para este ejercicio/)).toBeVisible();
    expect(screen.getByText('Ejercicio consultado:')).toHaveTextContent('2026');
    expect(screen.queryByText('Sin pagos registrados')).toBeNull();
    expect(screen.getByText('Pagos sin fecha')).toBeVisible();
    expect(screen.getByText('Años con pago registrado')).toBeVisible();
    expect(screen.queryByText('Años al día')).toBeNull();
  });
  it('highlights a recorded payment for the selected year', async () => {
    queries.pagos.mockResolvedValue([{ id: 'p-qa', anio: 2026, montoTEF: 100, fechaPago: null }]);
    open('fiscal', '&ejercicio=2026');
    expect(await screen.findByText('Ejercicio consultado', { exact: true })).toBeVisible();
    expect(screen.queryByText(/No hay pagos registrados para este ejercicio/)).toBeNull();
  });
  it('does not claim that the selected year is empty after a failed read', async () => {
    queries.pagos.mockRejectedValue(new Error('offline'));
    open('fiscal', '&ejercicio=2026');
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar la situación fiscal');
    expect(screen.queryByText(/No hay pagos registrados para este ejercicio/)).toBeNull();
  });
  it('returns to the originating notice with its scoped inbox filter', async () => {
    const entry = { owner: 'qa-owner', search: 'avisos=sin-leer&pagina=2' };
    open('fiscal', '&ejercicio=2026', { actorReturn: '/notificaciones/n1', notificationInboxReturn: entry });
    await screen.findByText(/No hay pagos registrados para este ejercicio/);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al aviso' }));
    expect(screen.getByTestId('notice-return')).toHaveTextContent('avisos=sin-leer&pagina=2');
  });
  it('hides the unrelated certificate panel during fiscal review without losing its state', async () => {
    open();
    const field = screen.getByLabelText('Borrador del certificado') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'contenido conservado' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Situación fiscal' }));
    expect(field).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Información general' }));
    expect(screen.getByLabelText('Borrador del certificado')).toBe(field);
    expect(field).toHaveValue('contenido conservado');
  });
  it('describes notification and qualification states without relying on colored dots', async () => {
    queries.pagos.mockResolvedValue([{ id: 'p-qa', anio: 2026, montoTEF: 100, fechaPago: null, notificado: false, habilitado: null }]);
    open('fiscal', '&ejercicio=2026');
    expect(await screen.findByText('Sin notificación registrada')).toBeInTheDocument();
    expect(screen.getByText('No informada')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Notificación' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Fecha de pago' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Editar pago de 2026' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Eliminar pago de 2026' })).toBeVisible();
  });

  it('does not infer compliance from an absent record or an unspecified qualification', async () => {
    open();
    const summary = screen.getByRole('region', { name: 'Resumen del generador' });
    await waitFor(() => expect(within(summary).getAllByText('Sin registro')).toHaveLength(2));
    expect(within(summary).queryByText('No', { exact: true })).toBeNull();
    expect(within(summary).queryByText('Pendiente')).toBeNull();
  });

  it.each([
    ['ddjj', 'No pudimos consultar las declaraciones juradas.', 'Reintentar declaraciones', 'Sin DDJJ registradas'],
    ['documentos', 'No pudimos consultar los documentos.', 'Reintentar documentos', 'Sin documentos adjuntos'],
  ] as const)('reports a failed %s query independently and retries it', async (key, message, retry, empty) => {
    queries[key].mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    open('ddjj');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(screen.queryByText(empty)).toBeNull();
    fireEvent.click(within(alert).getByRole('button', { name: retry }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText(empty)).toBeVisible();
    expect(queries[key]).toHaveBeenCalledTimes(2);
  });

  it('keeps category once and a readable creation date', async () => {
    open();
    await waitFor(() => expect(queries.pagos).toHaveBeenCalledOnce());
    expect(screen.getAllByText('PEQUENO GENERADOR')).toHaveLength(1);
    expect(screen.getByText('01/10/2026')).toBeVisible();
  });
});
