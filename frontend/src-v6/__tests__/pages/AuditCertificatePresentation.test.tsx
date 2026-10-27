import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AuditoriaPage from '../../pages/auditoria/AuditoriaPage';

const mocks = vi.hoisted(() => ({ auditoria: vi.fn(), download: vi.fn() }));
vi.mock('../../services/reporte.service', () => ({ reporteService: { auditoria: mocks.auditoria } }));
vi.mock('../../hooks/useUsuarios', () => ({ useUsuarios: () => ({ data: [] }) }));
vi.mock('../../pages/reportes/tabs/shared', () => ({ downloadCsv: mocks.download }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

const legacy = 'Certificaciones emitidas y firmadas por el operador';
const marker = { id: 'marker', fecha: '2026-10-20T10:00:00Z', usuario: 'QA', rol: 'OPERADOR',
  tipo: 'CERTIFICACION_OPERADOR_V1', descripcion: legacy, manifiestoNumero: 'QA-001' };
const normal = { ...marker, id: 'ordinary', tipo: 'INCIDENTE', descripcion: 'Incidente documentado' };
function setup() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AuditoriaPage /></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => {
  mocks.auditoria.mockReset(); mocks.download.mockReset();
  mocks.auditoria.mockImplementation(async (params: { fuente: string }) => ({
    eventos: params.fuente === 'inspecciones' ? [{ ...marker, modulo: 'Inspecciones' }] : [marker, normal],
    resumen: { total: params.fuente === 'inspecciones' ? 1 : 2, porTipo: {} },
    pagination: { total: params.fuente === 'inspecciones' ? 1 : 2, pages: 1 },
  }));
});

it('clarifies an activation marker in both responsive layouts and retains the historical wording', async () => {
  setup();
  expect(await screen.findAllByText('Gestión de certificados configurada')).toHaveLength(2);
  expect(screen.getAllByText(/Este evento no es un certificado emitido/)).toHaveLength(2);
  for (const summary of screen.getAllByText('Texto original registrado')) {
    expect(within(summary.parentElement as HTMLElement).getByText(legacy)).toBeInTheDocument();
  }
  expect(screen.getAllByText('Incidente documentado')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'CSV de esta página' }));
  const [, headers, rows] = mocks.download.mock.calls[0];
  expect(headers).toContain('Aclaración');
  expect(rows[0]).toContain(legacy);
  expect(rows[0][headers.indexOf('Aclaración')]).toContain('no es un certificado emitido');
});

it('identifies page-scoped search and download and names the date and pagination controls', async () => {
  setup();
  await screen.findAllByText('Incidente documentado');
  expect(screen.getByPlaceholderText('Buscar en esta página...')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'CSV de esta página' })).toBeEnabled();
  expect(screen.getByLabelText('Desde')).toBeInTheDocument();
  expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Registros por página' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Página anterior' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Buscar en esta página...'), { target: { value: 'QA-001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
  expect(screen.getByPlaceholderText('Buscar en esta página...')).toHaveValue('');
});

it('does not present a failed request as an empty audit', async () => {
  mocks.auditoria.mockRejectedValue(new Error('offline'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar');
  expect(screen.queryByText('No se encontraron registros')).toBeNull();
});

it('does not reinterpret an inspection event with the same code', async () => {
  setup();
  await screen.findAllByText('Incidente documentado');
  fireEvent.click(screen.getByRole('button', { name: 'Módulo' }));
  fireEvent.click(screen.getByRole('option', { name: 'Inspecciones' }));
  expect(await screen.findAllByText(legacy)).toHaveLength(2);
  expect(screen.queryByText('Gestión de certificados configurada')).toBeNull();
});
