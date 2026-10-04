import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Inspection } from '../../types/inspection';
import Page from '../../pages/inspecciones/InspeccionExpedientePage';

const service = vi.hoisted(() => ({ get: vi.fn(), saveDraft: vi.fn(), transition: vi.fn() }));
const checkpoint = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('../../services/inspectionFieldCheckpoint', () => ({ readInspectionFieldCheckpoint: checkpoint.read, writeInspectionFieldCheckpoint: checkpoint.write }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'qa-inspector', rol: 'GENERADOR', esInspector: true, nombre: 'QA inspector' } }),
}));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: service }));
vi.mock('../../services/indexeddb', () => ({ saveOffline: vi.fn().mockResolvedValue(undefined), getOffline: vi.fn() }));
vi.mock('../../services/inspectionOfflineEvidence', () => ({
  listPendingInspectionEvidence: vi.fn().mockResolvedValue([]),
  syncPendingInspectionEvidence: vi.fn().mockResolvedValue({ synchronized: 0, failed: 0 }),
  INSPECTION_EVIDENCE_ACCEPT: '.pdf', INSPECTION_PHOTO_ACCEPT: 'image/*',
}));
vi.mock('../../services/warmInspectionShell', () => ({ warmInspectionShell: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../components/ui/Toast', () => ({ toast: toasts }));
vi.mock('../../pages/inspecciones/InspectionComparisonPanel', () => ({ InspectionComparisonPanel: () => null }));
vi.mock('../../pages/inspecciones/InspectionExchangePanel', () => ({ InspectionExchangePanel: () => null }));
vi.mock('../../pages/inspecciones/InspectionTimeline', () => ({ InspectionTimeline: () => null }));
vi.mock('../../pages/inspecciones/InspectionOrganizationPanel', () => ({ InspectionOrganizationPanel: () => null }));

// Keep the real ownership hook and React Query invalidation: a permanently
// owned mock misses the asynchronous grant on a freshly reopened app.
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
function installLocks() {
  const held = new Set<string>();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => {
      await Promise.resolve();
      expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
      if (held.has(name)) return callback(null);
      held.add(name);
      try { return await callback({ name, mode: 'exclusive' } as Lock); }
      finally { held.delete(name); }
    },
  } });
}

const key = 'sitrep_inspection_draft_qa-inspector_qa-case';
let server: Inspection;
const clients: QueryClient[] = [];
function fixture(): Inspection {
  return {
    id: 'qa-case', numero: 'IRP-2026-00001', numeroActa: null, tipoActor: null, estado: 'PLANIFICADA',
    inspectorId: 'qa-inspector', inspector: { id: 'qa-inspector', nombre: 'QA inspector' },
    generador: null, operador: null, transportista: null, ubicacion: 'QA lugar',
    observaciones: 'Descripción inicial QA', datosActa: {}, informeTecnico: {}, plazoRespuestaAt: null,
    fechaProgramada: null, iniciadaAt: null, cerradaCampoAt: null, version: 1,
    createdAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
    items: [{ id: 'qa-item', codigo: 'QA-01', categoria: 'Hallazgo', etiqueta: 'Hallazgo', orden: 1,
      obligatorio: true, resultado: 'PENDIENTE', observacion: null, evidencias: [] }],
    comparaciones: [], evidencias: [], eventos: [],
  };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/inspecciones/qa-case#acta']}>
    <Routes><Route path="/inspecciones/:id" element={<Page />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}
async function editor() {
  const input = await screen.findByLabelText('Descripción de la denuncia o hallazgo');
  await waitFor(() => expect(input).toBeEnabled());
  // A synchronous DOM assertion can observe the enabled commit before React
  // finishes its passive effects. Commit the real pagehide listener before
  // simulating termination; do not wait for the 350ms automatic backup instead.
  await act(async () => { await Promise.resolve(); });
  return input;
}
async function reopen(tree: ReturnType<typeof mount>, durableCopy: string) {
  tree.unmount();
  await act(async () => { await Promise.resolve(); });
  // Reproduce Android force-stop restoring an earlier disk commit rather than
  // merely reloading the same renderer's in-memory localStorage map.
  localStorage.setItem(key, durableCopy);
  mount();
  await screen.findByLabelText('Descripción de la denuncia o hallazgo');
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); installLocks(); server = fixture();
  checkpoint.read.mockResolvedValue(undefined); checkpoint.write.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  service.get.mockImplementation(async () => structuredClone(server));
  service.saveDraft.mockImplementation(async (_id, payload) => {
    expect(payload.version).toBe(server.version);
    server = { ...server, ...payload, version: server.version + 1,
      items: server.items.map(item => ({ ...item, ...payload.items.find((row: { id: string }) => row.id === item.id) })) };
    return structuredClone(server);
  });
  service.transition.mockImplementation(async (_id, version, state) => {
    expect(version).toBe(server.version); server = { ...server, estado: state, version: server.version + 1 };
    return structuredClone(server);
  });
});
afterEach(async () => {
  cleanup(); for (const client of clients.splice(0)) client.clear();
  await act(async () => { await Promise.resolve(); });
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
  else Reflect.deleteProperty(navigator, 'locks');
});

describe('inspection process restart with real asynchronous draft ownership', () => {
  it.each([false, true])('does not discard unproven legacy edits alongside a durable snapshot (edited=%s)', async edited => {
    const tree = mount(); await editor(); fireEvent(window, new Event('pagehide'));
    const journal = JSON.parse(localStorage.getItem(key)!);
    delete journal.checkpointAt;
    if (edited) journal.observaciones = 'Edición de un cliente anterior';
    server = { ...server, version: 2, observaciones: 'Servidor actual confirmado' };
    checkpoint.read.mockResolvedValue(JSON.stringify({ ...journal, version: 2, observaciones: server.observaciones, checkpointAt: Date.now() + 1 }));
    await reopen(tree, JSON.stringify(journal));
    if (edited) expect(await screen.findByText('Hay un borrador anterior sin conciliar')).toBeVisible();
    else {
      expect(await editor()).toHaveValue('Servidor actual confirmado');
      expect(screen.queryByText('Hay un borrador anterior sin conciliar')).not.toBeInTheDocument();
    }
    expect(service.saveDraft).not.toHaveBeenCalled();
  });

  it('synchronizes a recovered spontaneous testimony with no checklist when connectivity returns', async () => {
    server.items = [];
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    mount();
    const field = await editor();
    fireEvent.change(field, { target: { value: 'Hallazgo espontáneo sin checklist ni ACK' } });
    fireEvent(window, new Event('pagehide'));
    await waitFor(() => expect(checkpoint.write).toHaveBeenCalled());
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(service.saveDraft).toHaveBeenCalled());
    expect(server.observaciones).toBe('Hallazgo espontáneo sin checklist ni ACK');
    expect(server.items).toEqual([]);
  });

  it('does not expose an older server editor when the durable copy cannot be read, and can retry', async () => {
    checkpoint.read.mockRejectedValue(new Error('storage unavailable'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo verificar la copia local');
    expect(screen.queryByLabelText('Descripción de la denuncia o hallazgo')).not.toBeInTheDocument();
    expect(service.saveDraft).not.toHaveBeenCalled();
    checkpoint.read.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar copia local' }));
    expect(await editor()).toHaveValue('Descripción inicial QA');
  });

  it('does not resurrect an explicitly discarded draft from an older localStorage disk journal', async () => {
    const tree = mount(); await editor(); fireEvent(window, new Event('pagehide'));
    const oldJournal = localStorage.getItem(key)!;
    checkpoint.read.mockResolvedValue(null);
    await reopen(tree, JSON.stringify({ ...JSON.parse(oldJournal), observaciones: 'Texto descartado' }));
    expect(await editor()).toHaveValue('Descripción inicial QA');
    expect(service.saveDraft).not.toHaveBeenCalled();
  });

  it('recovers the confirmed device copy when Android restores an older localStorage journal', async () => {
    const tree = mount(); await editor(); fireEvent(window, new Event('pagehide'));
    const oldJournal = localStorage.getItem(key)!;
    const latest = { ...JSON.parse(oldJournal), observaciones: 'Hallazgo nuevo sin ACK del servidor' };
    checkpoint.read.mockResolvedValue(JSON.stringify(latest));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await reopen(tree, oldJournal);
    expect(await editor()).toHaveValue(latest.observaciones);
    expect(server.observaciones).toBe('Descripción inicial QA');
    expect(service.saveDraft).not.toHaveBeenCalled();
  });

  it('uses the current server copy when force-stop restores an unchanged old snapshot', async () => {
    const tree = mount(); await editor();
    fireEvent(window, new Event('pagehide'));
    const durableCopy = localStorage.getItem(key)!;
    expect(JSON.parse(durableCopy)).toMatchObject({ version: 1, observaciones: 'Descripción inicial QA' });
    fireEvent.click(screen.getByRole('link', { name: 'Visita', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar visita', exact: true }));
    await waitFor(() => expect(server.estado).toBe('EN_CAMPO'));
    fireEvent.change(await editor(), { target: { value: 'Comentario confirmado después de iniciar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios', exact: true }));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Cambios confirmados en el servidor', expect.any(String)));
    expect(server.version).toBe(4);
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ version: 4, observaciones: server.observaciones });
    await reopen(tree, durableCopy);
    await waitFor(() => expect(screen.queryByText('Hay un borrador anterior sin conciliar')).not.toBeInTheDocument());
    const reopened = await editor();
    expect(reopened).toHaveValue('Comentario confirmado después de iniciar');
    expect(screen.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
    expect(service.saveDraft).toHaveBeenCalledTimes(2);
    fireEvent.change(reopened, { target: { value: 'Nueva observación después de reabrir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios', exact: true }));
    await waitFor(() => expect(server.version).toBe(5));
    expect(server.observaciones).toBe('Nueva observación después de reabrir');
  });

  it('preserves a genuinely edited older copy and requires explicit reconciliation', async () => {
    const tree = mount();
    fireEvent.change(await editor(), { target: { value: 'Hallazgo local sin enviar' } });
    fireEvent(window, new Event('pagehide'));
    const durableCopy = localStorage.getItem(key)!;
    server = { ...server, estado: 'EN_CAMPO', version: 4, observaciones: 'Cambio de otro inspector en servidor' };
    await reopen(tree, durableCopy);
    expect(await screen.findByText('Hay un borrador anterior sin conciliar')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Observaciones generales/ })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ version: 1, observaciones: 'Hallazgo local sin enviar' });
    expect(service.saveDraft).not.toHaveBeenCalled();
  });

  it.each(['legacy', 'partial', 'future'])('does not silently discard an unproven %s copy', async (kind) => {
    const tree = mount(); await editor(); fireEvent(window, new Event('pagehide'));
    const copy = JSON.parse(localStorage.getItem(key)!);
    if (kind === 'legacy') delete copy.baseFingerprint;
    if (kind === 'partial') delete copy.items;
    if (kind === 'future') copy.version = 9;
    server = { ...server, estado: 'EN_CAMPO', version: 4, observaciones: 'Servidor actual' };
    await reopen(tree, JSON.stringify(copy));
    expect(await screen.findByText('Hay un borrador anterior sin conciliar')).toBeVisible();
    expect(localStorage.getItem(key)).toBe(JSON.stringify(copy));
    expect(service.saveDraft).not.toHaveBeenCalled();
  });
});
