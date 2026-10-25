import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ActorDocuments } from '../../components/ActorDocuments';
import { OperadorDocuments } from '../../components/OperadorDocuments';

const mock = vi.hoisted(() => ({ role: 'ADMIN_TRANSPORTISTA', transport: vi.fn(), operator: vi.fn(), uploadTransport: vi.fn(), uploadOperator: vi.fn(), review: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'reader', rol: mock.role } }) }));
vi.mock('../../services/generador-fiscal.service', () => ({
  transportistaDocumentoService: { getDocumentos: mock.transport, upload: mock.uploadTransport },
  operadorFiscalService: { getDocumentos: mock.operator, uploadDocumento: mock.uploadOperator },
  generadorFiscalService: { revisarDocumento: mock.review, downloadDocumento: vi.fn() },
  documentoIdentityService: { confirmarPago: vi.fn() },
}));
vi.mock('../../components/DocumentUpload', () => ({ default: (props: any) => <div>
  <span>{props.documentos.map((doc: any) => doc.nombre).join(',')}</span>
  {!props.readOnly && <button onClick={() => props.onUpload(new File(['QA'], 'otro.pdf'), 'OTRO', 2026)}>Adjuntar</button>}
  {props.isAdmin && <button onClick={() => props.onRevisar('document', 'APROBADO')}>Revisar documento</button>}
</div> }));
beforeEach(() => {
  vi.clearAllMocks(); mock.role = 'ADMIN_TRANSPORTISTA';
  mock.transport.mockResolvedValue([{ id: 'document', nombre: 'transporte.pdf' }]);
  mock.operator.mockResolvedValue([{ id: 'document', nombre: 'operador.pdf' }]);
  mock.uploadTransport.mockResolvedValue({}); mock.uploadOperator.mockResolvedValue({});
});
const open = (element = <ActorDocuments actorId="carrier" cuit="99000000000" actorType="TRANSPORTISTA" />) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{element}</QueryClientProvider>);
it('transport administration reads and uploads against the transport document service', async () => {
  open(); await screen.findByText('transporte.pdf');
  expect(mock.transport).toHaveBeenCalledWith('carrier'); expect(mock.operator).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Adjuntar' }));
  await waitFor(() => expect(mock.uploadTransport).toHaveBeenCalledWith('carrier', expect.any(File), 'OTRO', 2026));
  expect(mock.uploadOperator).not.toHaveBeenCalled();
});
it.each(['TRANSPORTISTA', 'ADMIN_OPERADOR'])('%s cannot review or upload transport documents through this panel', async role => {
  mock.role = role; open(); await screen.findByText('transporte.pdf');
  expect(screen.queryByRole('button', { name: 'Adjuntar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Revisar documento' })).not.toBeInTheDocument();
  expect(mock.review).not.toHaveBeenCalled();
});
it('the operator wrapper retains its own source and sector actions', async () => {
  mock.role = 'ADMIN_OPERADOR'; open(<OperadorDocuments actorId="operator" cuit="99000000001" />);
  await screen.findByText('operador.pdf'); expect(mock.operator).toHaveBeenCalledWith('operator'); expect(mock.transport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Adjuntar' }));
  await waitFor(() => expect(mock.uploadOperator).toHaveBeenCalledWith('operator', expect.any(File), 'OTRO', 2026));
  expect(mock.uploadTransport).not.toHaveBeenCalled();
});
it('a failed read remains explicit and can be retried without an empty success state', async () => {
  mock.transport.mockRejectedValueOnce(new Error('offline')); open();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar');
  expect(screen.queryByRole('button', { name: 'Adjuntar' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar documentos' }));
  await screen.findByText('transporte.pdf'); expect(mock.transport).toHaveBeenCalledTimes(2);
});
