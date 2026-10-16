import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdendasManifiestoPage from '../../pages/manifiestos/AdendasManifiestoPage';
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mock }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-user' } }) }));
const record = { id: 'qa-adenda', motivo: 'Diferencia de carga', rectificaId: null, version: 0, estadoRevision: 'PENDIENTE', puedeResolver: false,
  creadoPorId: 'qa-carrier', createdAt: '2026-10-15T00:00:00Z', residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }],
  declaracion: { numero: 'QA-1', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] }, revisiones: [] };
const data = { adendas: [record], total: 1, puedeRegistrar: false, manifiesto: { numero: 'QA-1', estado: 'TRATADO' } };
function view() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } })}>
    <MemoryRouter initialEntries={['/manifiestos/qa-id/adendas']}><Routes><Route path="/manifiestos/:id/adendas" element={<AdendasManifiestoPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_MANIFEST_ADDENDA_ENABLED', 'true'); mock.get.mockResolvedValue({ data: { data } }); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it('flag off makes no request', () => { vi.stubEnv('VITE_MANIFEST_ADDENDA_ENABLED', 'false'); view(); expect(mock.get).not.toHaveBeenCalled(); });
it('keeps original and observed loads separate; read-only participant has no write controls', async () => {
  view(); await screen.findByText('Y1 · 10 kg'); expect(screen.getByText('Y2 · 12 kg')).toBeVisible();
  expect(screen.getByText(/Operación: TRATADO/)).toBeVisible();
  expect(screen.getByText('Pendiente de revisión')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Aprobar post facto' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Registrar diferencia' })).not.toBeInTheDocument();
});
it('failed resolution retains the reason and idempotency key, never shows false approval', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, adendas: [{ ...record, puedeResolver: true }] } } });
  mock.post.mockRejectedValue(new Error('offline')); view();
  const note = await screen.findByLabelText('Motivo de resolución');
  fireEvent.change(note, { target: { value: 'Revisión con evidencia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar post facto' })); await screen.findByRole('alert');
  expect(note).toHaveValue('Revisión con evidencia'); expect(screen.getByText('Pendiente de revisión')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Aprobar post facto' }));
  await waitFor(() => expect(mock.post).toHaveBeenCalledTimes(2)); expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
});
it('successful write invalidates even a fresh list and shows the server resolution', async () => {
  const reviewable = { ...record, puedeResolver: true };
  mock.get.mockResolvedValueOnce({ data: { data: { ...data, adendas: [reviewable] } } })
    .mockResolvedValue({ data: { data: { ...data, adendas: [{ ...reviewable, estadoRevision: 'OBSERVADA', version: 1 }] } } });
  mock.post.mockResolvedValue({ data: {} }); view();
  fireEvent.change(await screen.findByLabelText('Motivo de resolución'), { target: { value: 'Revisar evidencia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Observar' })); await screen.findByText('Observada');
  expect(mock.get).toHaveBeenCalledTimes(2); expect(screen.getByText('Y1 · 10 kg')).toBeVisible();
});
it('read errors are not an empty-list success', async () => {
  mock.get.mockRejectedValue(new Error('offline')); view(); await screen.findByRole('alert');
  expect(screen.queryByText('Todavía no hay adendas.')).not.toBeInTheDocument();
});
it('shows global documentary counts, not a false closure inferred from the visible page', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, total: 25, documental: { pendientes: 23, observadas: 1, rechazadas: 1, estado: 'RECHAZADA', cierreAcreditado: false } } } });
  view(); await screen.findByText('23 pendientes · 1 observada · 1 rechazada');
  expect(screen.getByText('Hay revisiones por atender. El cierre operativo no las aprueba.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
});
it('all reviewed does not assert documentary closure', async () => {
  mock.get.mockResolvedValue({ data: { data: { ...data, documental: { pendientes: 0, observadas: 0, rechazadas: 0, estado: 'ADENDAS_REVISADAS', cierreAcreditado: false } } } });
  view(); await screen.findByText('Adendas revisadas. No acredita el cierre documental del expediente.');
});
it('downloads current and explicit previous version without posting any changes', async () => {
  const current = { ...data, adendas: [{ ...record, version: 2 }] };
  mock.get.mockImplementation((_url, config) => Promise.resolve(config?.responseType === 'blob' ? { data: new Blob(['%PDF-']) } : { data: { data: current } }));
  const create = vi.fn(() => 'blob:qa'); vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    view(); fireEvent.click(await screen.findByRole('button', { name: 'Descargar anexo v2' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Trazabilidad de la adenda'));
    fireEvent.change(screen.getByLabelText('Versión anterior'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar versión anterior' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(mock.get).toHaveBeenCalledWith('/manifiestos/qa-id/adendas/qa-adenda/anexo', { params: { version: 1 }, responseType: 'blob' });
    expect(mock.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Versión anterior'), { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Descargar versión anterior' })).toBeDisabled();
  } finally { await new Promise(resolve => setTimeout(resolve, 1100)); vi.unstubAllGlobals(); }
});
it('download failure keeps existing facts and offers retry without false success', async () => {
  mock.get.mockResolvedValueOnce({ data: { data } }).mockRejectedValue(new Error('offline'));
  view(); fireEvent.click(await screen.findByRole('button', { name: 'Descargar anexo v0' }));
  await screen.findByText('No se pudo descargar el anexo. Tus datos y revisiones no cambiaron.');
  expect(screen.getByText('Y1 · 10 kg')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Descargar anexo v0' })).toBeEnabled();
  expect(mock.post).not.toHaveBeenCalled();
});
