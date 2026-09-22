import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionExchangePanel } from '../../pages/inspecciones/InspectionExchangePanel';
import type { InspectionExchangeTimeline } from '../../types/inspection';

const auth = vi.hoisted(() => ({ currentUser: { id: 'actor-user-1', rol: 'GENERADOR', nombre: 'Responsable' } as any }));
const mocks = vi.hoisted(() => ({
  getExchanges: vi.fn(),
  presentExchange: vi.fn(),
  decideExchange: vi.fn(),
  attachmentUrl: vi.fn(),
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
  removeDraft: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: mocks }));
vi.mock('../../services/inspectionOfflineExchange', () => ({
  loadOfflineExchangeDraft: mocks.loadDraft,
  saveOfflineExchangeDraft: mocks.saveDraft,
  removeOfflineExchangeDraft: mocks.removeDraft,
}));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const timeline: InspectionExchangeTimeline = {
  inspeccion: {
    id: 'inspection-1', numero: 'I-2026-000001', numeroActa: '116-2026', estado: 'NOTIFICADA',
    tipoActor: 'GENERADOR', actor: { id: 'generator-1', razonSocial: 'Generador QA', cuit: '30-00000000-1' },
    plazoRespuestaAt: '2099-09-30T18:00:00.000Z', version: 8,
  },
  parteActual: 'INSPECCIONADO',
  comunicacionExterna: false,
  intercambios: [{
    id: 'exchange-1', inspeccionId: 'inspection-1', secuencia: 1, clienteId: null, respondeAId: null,
    tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', asunto: 'Acompañar constancia vigente',
    cuerpo: 'Presente la constancia y el plan de adecuación dentro del plazo indicado.',
    plazoRespuestaAt: '2099-09-30T18:00:00.000Z', presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP',
    versionExpediente: 8, contenidoSha256: 'a'.repeat(64), hashAnterior: null, hashCadena: 'b'.repeat(64),
    autorId: 'admin-1', createdAt: '2026-09-22T15:00:00.000Z',
    autor: { id: 'admin-1', nombre: 'Ana', apellido: 'Auditora', rol: 'ADMIN_GENERADOR' }, adjuntos: [],
  }, {
    id: 'exchange-2', inspeccionId: 'inspection-1', secuencia: 2, clienteId: null, respondeAId: 'exchange-1',
    tipo: 'RESPUESTA', parte: 'INSPECCIONADO', asunto: 'Respuesta documental inicial',
    cuerpo: 'Se acompaña una primera constancia para análisis de la autoridad.',
    plazoRespuestaAt: null, presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP',
    versionExpediente: 9, contenidoSha256: 'c'.repeat(64), hashAnterior: 'b'.repeat(64), hashCadena: 'd'.repeat(64),
    autorId: 'actor-user-1', createdAt: '2026-09-23T15:00:00.000Z',
    autor: { id: 'actor-user-1', nombre: 'Responsable', apellido: 'Ambiental', rol: 'GENERADOR' }, adjuntos: [],
  }],
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><InspectionExchangePanel inspectionId="inspection-1" /></QueryClientProvider>);
}

describe('InspectionExchangePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    auth.currentUser = { id: 'actor-user-1', rol: 'GENERADOR', nombre: 'Responsable' };
    mocks.getExchanges.mockResolvedValue(timeline);
    mocks.presentExchange.mockResolvedValue({ id: 'exchange-2' });
    mocks.decideExchange.mockResolvedValue({ id: 'exchange-3' });
    mocks.loadDraft.mockResolvedValue(null);
    mocks.saveDraft.mockResolvedValue(undefined);
    mocks.removeDraft.mockResolvedValue(undefined);
  });

  it('requires an inspected-party response to be linked to the authority presentation', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Presentaciones y respuestas' })).toBeInTheDocument();
    expect(screen.getByText('Acompañar constancia vigente')).toBeInTheDocument();
    expect(screen.getByText(/no envía correos/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Ciclo 1:/ })).toBeInTheDocument();
    expect(screen.getByText('2 actuaciones vinculadas')).toBeInTheDocument();
    expect(screen.getByText(/Responde a #1: Acompañar constancia vigente/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Responder esta actuación' }));
    expect(screen.getByText(/Antecedente: presentación #1/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Contenido'), 'Se acompaña la constancia vigente y el plan de adecuación solicitado.');
    const file = new File(['%PDF'], 'constancia.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/Adjuntos probatorios/i), file);
    await user.click(screen.getByRole('button', { name: 'Presentar en expediente' }));

    await waitFor(() => expect(mocks.presentExchange).toHaveBeenCalledWith('inspection-1', expect.objectContaining({
      version: 8,
      tipo: 'DESCARGO',
      respondeAId: 'exchange-1',
      files: [file],
    })));
  });

  it('allows only the competent administrator view to record a reasoned legal derivation', async () => {
    auth.currentUser = { id: 'admin-1', rol: 'ADMIN_GENERADOR', nombre: 'Ana Auditora' };
    mocks.getExchanges.mockResolvedValue({ ...timeline, parteActual: 'AUTORIDAD' });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Derivar a Legales' }));
    await user.type(screen.getByLabelText('Fundamento de la decisión'), 'Persisten incumplimientos documentados que requieren dictamen jurídico.');
    await user.type(screen.getByLabelText(/Referencia de expediente legal/i), 'EX-2026-000099');
    await user.click(screen.getByRole('button', { name: 'Confirmar derivación' }));

    await waitFor(() => expect(mocks.decideExchange).toHaveBeenCalledWith('inspection-1', expect.objectContaining({
      version: 8,
      decision: 'DERIVADA_LEGALES',
      fundamento: 'Persisten incumplimientos documentados que requieren dictamen jurídico.',
      expedienteLegal: 'EX-2026-000099',
      clienteId: expect.stringMatching(/^decision_/),
      files: [],
    })));
  });

  it('preserves an offline response and its file but never auto-submits it', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Responder esta actuación' }));
    await user.type(screen.getByLabelText('Contenido'), 'Respuesta conservada localmente hasta recuperar conexión.');
    const file = new File(['%PDF'], 'evidencia-offline.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/Adjuntos probatorios/i), file);

    expect(screen.getByText(/SITREP nunca autoenvía un descargo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Presentar en expediente' })).toBeDisabled();
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledWith(
      'actor-user-1',
      'inspection-1',
      expect.objectContaining({ respondeAId: 'exchange-1' }),
      [file],
    ));
    expect(mocks.presentExchange).not.toHaveBeenCalled();
  });
});
