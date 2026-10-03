import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Inspection } from '../../types/inspection';
import { inspeccionService } from '../../services/inspeccion.service';
import { queueInspectionEvidence, syncPendingInspectionEvidence } from '../../services/inspectionOfflineEvidence';
import { toast } from '../../components/ui/Toast';
import InspeccionExpedientePage from '../../pages/inspecciones/InspeccionExpedientePage';

const useInspectionMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/inspectionFieldCheckpoint', () => ({ readInspectionFieldCheckpoint: vi.fn().mockResolvedValue(undefined), writeInspectionFieldCheckpoint: vi.fn().mockResolvedValue(undefined) }));
const canWrite = () => true;
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'admin-1', rol: 'ADMIN', nombre: 'Admin' } }) }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: 'owned', canWrite }) }));
vi.mock('../../hooks/useCatalogos', () => ({ useCatalogoGeneradores: () => ({ data: [] }), useCatalogoOperadores: () => ({ data: [] }), useCatalogoTransportistas: () => ({ data: [] }) }));
vi.mock('../../hooks/useInspecciones', () => ({
  useInspection: useInspectionMock,
  useInspectionExchanges: () => ({ data: null, isLoading: false, isError: false }),
  useInspectionMutation: (mutationFn: (input: unknown) => Promise<unknown>) => ({ mutateAsync: vi.fn((input: unknown) => mutationFn(input)), isPending: false }),
}));
vi.mock('../../services/warmInspectionShell', () => ({ warmInspectionShell: vi.fn() }));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: { saveDraft: vi.fn(), uploadEvidence: vi.fn() } }));
vi.mock('../../services/inspectionOfflineEvidence', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/inspectionOfflineEvidence')>(),
  listPendingInspectionEvidence: vi.fn().mockResolvedValue([]),
  queueInspectionEvidence: vi.fn(),
  syncPendingInspectionEvidence: vi.fn(),
  pendingEvidenceFile: vi.fn(),
}));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const inspection: Inspection = {
  id: 'inspection-audio', numero: 'I-2026-AUDIO', numeroActa: 'ACTA-01', estado: 'EN_CAMPO',
  tipoActor: 'GENERADOR', inspectorId: 'admin-1', inspector: { id: 'admin-1', nombre: 'Admin' },
  generador: { id: 'generator-1', razonSocial: 'Planta de prueba', cuit: '30-12345678-9' },
  ubicacion: 'Mendoza', observaciones: 'Observación inicial', version: 7,
  createdAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
  items: [], comparaciones: [], evidencias: [], eventos: [],
};

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  mimeType = 'audio/webm';
  state = 'inactive';
  onerror: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => Promise<void>) | null = null;
  constructor() { MockMediaRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; void this.onstop?.(); }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn();
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

async function renderRecorder(dirty = false) {
  useInspectionMock.mockReturnValue({ data: inspection, isLoading: false, refetch: vi.fn().mockResolvedValue({ data: inspection }) });
  render(<MemoryRouter initialEntries={['/mobile/inspecciones/inspection-audio#acta']}><Routes>
    <Route path="/mobile/inspecciones/:id" element={<InspeccionExpedientePage />} />
    <Route path="/mobile/inspecciones" element={<h1>Inspecciones disponibles</h1>} />
  </Routes></MemoryRouter>);
  if (dirty) fireEvent.change(await screen.findByLabelText('Registro de lo observado'), { target: { value: 'Hallazgo conservado tras el error de audio' } });
  fireEvent.click(await screen.findByRole('link', { name: 'Fotos y archivos', exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar y salir de la inspección' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio', exact: true }));
  expect(await screen.findByText('Grabando audio de campo')).toBeInTheDocument();
  return MockMediaRecorder.instances[0];
}

describe('Inspection audio failure recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    MockMediaRecorder.instances = [];
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    vi.mocked(inspeccionService.saveDraft).mockResolvedValue({ ...inspection, version: 8 });
    vi.mocked(queueInspectionEvidence).mockImplementation(async (_inspectionId, _userId, file) => ({ id: 'pending-audio', sha256: 'audio-hash', blob: file } as Awaited<ReturnType<typeof queueInspectionEvidence>>));
    vi.mocked(syncPendingInspectionEvidence).mockImplementation(async ({ upload }) => {
      await upload({ id: 'pending-audio', fields: {}, capturedAt: '2026-10-02T12:00:00Z' } as Parameters<typeof upload>[0]);
      return { synchronized: 1, failed: 0, skipped: 0 };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('releases the microphone and lets the inspector save and leave immediately after an error', async () => {
    const recorder = await renderRecorder(true);
    expect(screen.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar y salir de la inspección' })).toBeDisabled();

    act(() => recorder.onerror?.());

    expect(stopTrack).toHaveBeenCalled();
    expect(screen.queryByText('Grabando audio de campo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grabar audio', exact: true })).toBeEnabled();
    expect(toast.error).toHaveBeenCalledWith('Grabación interrumpida', 'El audio no se guardó. Volvé a grabar.');
    expect(screen.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios', exact: true }));
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalledWith(inspection.id, expect.objectContaining({ observaciones: 'Hallazgo conservado tras el error de audio' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar y salir de la inspección' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir de la inspección' }));
    expect(await screen.findByRole('heading', { name: 'Inspecciones disponibles' })).toBeInTheDocument();
  });

  it.each(['partial audio', ''])('discards the final data and stop events after an error (data: %j)', async (data) => {
    const recorder = await renderRecorder();
    await act(async () => {
      recorder.onerror?.();
      recorder.ondataavailable?.({ data: new Blob([data], { type: 'audio/webm' }) });
      await recorder.onstop?.();
    });

    expect(queueInspectionEvidence).not.toHaveBeenCalled();
    expect(inspeccionService.uploadEvidence).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Grabación interrumpida', 'El audio no se guardó. Volvé a grabar.');
    expect(screen.queryByText('Grabando audio de campo')).not.toBeInTheDocument();
  });

  it('still queues and uploads a nonempty recording when the inspector stops it normally', async () => {
    const recorder = await renderRecorder();
    act(() => recorder.ondataavailable?.({ data: new Blob(['complete audio'], { type: 'audio/webm' }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Detener audio', exact: true }));

    await waitFor(() => expect(inspeccionService.uploadEvidence).toHaveBeenCalledTimes(1));
    expect(queueInspectionEvidence).toHaveBeenCalledTimes(1);
    const file = vi.mocked(queueInspectionEvidence).mock.calls[0][2];
    expect(file).toBeInstanceOf(File);
    expect(file.size).toBe(14);
    expect(file.type).toBe('audio/webm');
    expect(screen.queryByText('Grabando audio de campo')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does not let delayed events from a failed recording corrupt a new recording', async () => {
    const failedRecorder = await renderRecorder();
    act(() => failedRecorder.onerror?.());
    fireEvent.click(screen.getByRole('button', { name: 'Grabar audio', exact: true }));
    await screen.findByText('Grabando audio de campo');
    const retry = MockMediaRecorder.instances[1];

    await act(async () => {
      failedRecorder.ondataavailable?.({ data: new Blob(['damaged audio']) });
      await failedRecorder.onstop?.();
      retry.ondataavailable?.({ data: new Blob(['complete audio'], { type: 'audio/webm' }) });
    });
    expect(queueInspectionEvidence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Detener audio', exact: true }));

    await waitFor(() => expect(inspeccionService.uploadEvidence).toHaveBeenCalledTimes(1));
    expect(queueInspectionEvidence).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queueInspectionEvidence).mock.calls[0][2].size).toBe(14);
    expect(screen.queryByText('Grabando audio de campo')).not.toBeInTheDocument();
  });
});
