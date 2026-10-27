import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn(), role: 'GENERADOR' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'account', rol: mock.role } }) }));
vi.mock('../../services/api', () => ({ default: { get: mock.get } }));
vi.mock('../../services/generador-fiscal.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/generador-fiscal.service')>();
  return { ...actual, generadorFiscalService: { ...actual.generadorFiscalService, downloadDocumento: mock.download } };
});
import ActorCertificates from '../../components/ActorCertificates';
const certificate = { id: 'official', tipo: 'CERTIFICADO_AMBIENTAL', estado: 'APROBADO', anio: 2026, nombre: 'CAA oficial.pdf', createdAt: '2026-10-08T12:00:00Z' };
function open(highlightId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ActorCertificates type="GENERADOR" actorId="actor" highlightId={highlightId} /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); mock.role = 'GENERADOR'; mock.get.mockResolvedValue({ data: { data: { documentos: [certificate] } } }); mock.download.mockResolvedValue(undefined); });
it('the actor downloads the authenticated original without upload or publication controls', async () => {
  open(); fireEvent.click(await screen.findByRole('button', { name: 'Descargar CAA 2026', exact: true }));
  await waitFor(() => expect(mock.download).toHaveBeenCalledWith('official', 'CAA oficial.pdf'));
  expect(mock.get).toHaveBeenCalledWith('/actores/generadores/actor/documentos');
  expect(screen.queryByText('Cargar certificado oficial')).not.toBeInTheDocument();
  expect(screen.queryByText('Publicar certificado')).not.toBeInTheDocument();
});
it('identifies the exact certificate from the notice, including an older version', async () => {
  const newer = { ...certificate, id: 'newer', nombre: 'CAA nueva.pdf', createdAt: '2026-10-09T12:00:00Z' };
  mock.get.mockResolvedValue({ data: { data: { documentos: [newer, certificate] } } });
  open('official');
  expect(await screen.findByText('Certificado del aviso')).toBeVisible();
  expect(screen.getByText(/CAA oficial.pdf/).closest('details')).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Descargar versión anterior' }));
  await waitFor(() => expect(mock.download).toHaveBeenCalledWith('official', 'CAA oficial.pdf'));
});
it('explains when the certificate in the notice is no longer available', async () => {
  open('missing');
  expect(await screen.findByText(/El certificado del aviso ya no está disponible/)).toBeVisible();
});
it('a rejected certificate is identified as rejected, never pending or valid', async () => {
  mock.role = 'ADMIN_GENERADOR'; mock.get.mockResolvedValue({ data: { data: { documentos: [{ ...certificate, estado: 'RECHAZADO' }] } } });
  open(); expect(await screen.findByText('Rechazado por DGFA')).toBeVisible();
  expect(screen.queryByText('Pendiente de publicación por DGFA')).not.toBeInTheDocument();
  expect(screen.queryByText('Publicar certificado')).not.toBeInTheDocument();
});
it('a failed original download reports the failure and keeps retry available', async () => {
  mock.download.mockRejectedValueOnce(new Error('offline')); open();
  fireEvent.click(await screen.findByRole('button', { name: 'Descargar CAA 2026', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo descargar');
  fireEvent.click(screen.getByRole('button', { name: 'Descargar CAA 2026', exact: true }));
  await waitFor(() => expect(mock.download).toHaveBeenCalledTimes(2));
});
