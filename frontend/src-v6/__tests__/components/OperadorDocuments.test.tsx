import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ role: 'OPERADOR', get: vi.fn(), download: vi.fn(), upload: vi.fn(), review: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'account', rol: mock.role } }) }));
vi.mock('../../services/generador-fiscal.service', () => ({
  operadorFiscalService: { getDocumentos: mock.get, uploadDocumento: mock.upload },
  generadorFiscalService: { downloadDocumento: mock.download, revisarDocumento: mock.review }, documentoIdentityService: { confirmarPago: vi.fn() },
}));
import { OperadorDocuments } from '../../components/OperadorDocuments';
const bill = { id: 'bill', tipo: 'FACTURA_ELECTRICA', nombre: 'Factura-QA.pdf', anio: 2026, size: 100, createdAt: '2026-10-20T12:00:00Z', estado: 'PENDIENTE' };
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OperadorDocuments actorId="qa-op" cuit="99-00000000-0" /></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); mock.role = 'OPERADOR'; mock.get.mockResolvedValue([bill]); mock.download.mockResolvedValue(undefined); });
it.each(['OPERADOR', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA'])('%s reads the original without operator-sector writing controls', async role => {
  mock.role = role; open(); fireEvent.click(await screen.findByRole('button', { name: /Descargar Factura-QA/ }));
  await waitFor(() => expect(mock.download).toHaveBeenCalledWith('bill', 'Factura-QA.pdf'));
  expect(mock.get).toHaveBeenCalledWith('qa-op'); expect(screen.queryByLabelText('Tipo documento')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument(); expect(mock.upload).not.toHaveBeenCalled();
});
it.each(['ADMIN', 'ADMIN_OPERADOR'])('%s can attach and review using the existing sector endpoints', async role => {
  mock.role = role; open(); await screen.findByText('Factura-QA.pdf');
  expect(screen.getByLabelText('Tipo documento')).toHaveValue('FACTURA_ELECTRICA');
  fireEvent.click(screen.getByRole('button', { name: /Aprobar Factura-QA/ }));
  await waitFor(() => expect(mock.review).toHaveBeenCalledWith('bill', 'APROBADO', undefined));
});
it('a failed read exposes a retry and does not pretend the actor has no documents', async () => {
  mock.get.mockRejectedValueOnce(new Error('offline')); open();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar documentos', exact: true }));
  expect(await screen.findByText('Factura-QA.pdf')).toBeVisible(); expect(mock.get).toHaveBeenCalledTimes(2);
});
