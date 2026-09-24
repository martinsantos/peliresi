import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Inspection } from '../../types/inspection';
import InspeccionExpedientePage from '../../pages/inspecciones/InspeccionExpedientePage';
import { inspeccionService } from '../../services/inspeccion.service';
import { toast } from '../../components/ui/Toast';

const queryMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: 'owned', canWrite: () => true, retry: vi.fn() }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'inspector-1', rol: 'ADMIN' } }) }));
vi.mock('../../hooks/useInspecciones', () => ({
  useInspection: queryMock,
  useInspectionMutation: (fn: (input: unknown) => Promise<unknown>) => ({ mutateAsync: fn, isPending: false }),
}));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: {
  saveDraft: vi.fn(), updateTechnicalReport: vi.fn(),
  transition: vi.fn(), uploadEvidence: vi.fn(), annulEvidence: vi.fn(), addEvent: vi.fn(), downloadPdf: vi.fn(),
} }));
vi.mock('../../services/inspectionOfflineEvidence', async (importOriginal) => ({ ...await importOriginal<typeof import('../../services/inspectionOfflineEvidence')>(), listPendingInspectionEvidence: vi.fn().mockResolvedValue([]) }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('../../pages/inspecciones/InspectionComparisonPanel', () => ({ InspectionComparisonPanel: () => <div /> }));
vi.mock('../../pages/inspecciones/InspectionTimeline', () => ({ InspectionTimeline: () => <div /> }));
vi.mock('../../pages/inspecciones/InspectionVerificationBlock', () => ({ InspectionVerificationBlock: () => <div /> }));
vi.mock('../../pages/inspecciones/InspectionReport', () => ({ InspectionReport: () => <div /> }));

const key = 'sitrep_inspection_draft_inspector-1_inspection-1';
const fixture: Inspection = {
  id: 'inspection-1', numero: 'I-2026-000012', numeroActa: null, tipoActor: 'GENERADOR', estado: 'EN_CAMPO',
  inspectorId: 'inspector-1', inspector: { id: 'inspector-1', nombre: 'Inspectora' },
  generador: { id: 'actor-1', razonSocial: 'Planta demo', cuit: '30-12345678-9' }, operador: null, transportista: null,
  ubicacion: null, fechaProgramada: null, iniciadaAt: '2026-09-22T12:00:00.000Z', cerradaCampoAt: null,
  plazoRespuestaAt: null, observaciones: null, datosActa: {}, informeTecnico: {}, version: 1,
  createdAt: '2026-09-22T12:00:00.000Z', updatedAt: '2026-09-22T12:00:00.000Z',
  items: [{ id: 'item-1', codigo: 'DOC-01', categoria: 'Documentación', etiqueta: 'Documentación vigente', orden: 1, obligatorio: true, resultado: 'NO_CUMPLE', observacion: null, evidencias: [] }],
  comparaciones: [], evidencias: [], eventos: [],
};

function page() {
  return <MemoryRouter initialEntries={['/inspecciones/inspection-1#checklist/DOC-01']}><Routes><Route path="/inspecciones/:id" element={<InspeccionExpedientePage />} /></Routes></MemoryRouter>;
}
const editor = () => screen.getByRole('textbox', { name: 'Observación: Documentación vigente' });
const inline = () => within(screen.getByTestId('inspection-item-save-item-1'));

describe('explicit save next to an inspection comment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    queryMock.mockReturnValue({ data: fixture, isLoading: false, refetch: vi.fn().mockResolvedValue({ data: fixture }) });
    vi.mocked(inspeccionService.saveDraft).mockResolvedValue({ version: 2 } as Inspection);
  });
  afterEach(() => vi.restoreAllMocks());

  it('saves the entire draft atomically and confirms only after the server responds', async () => {
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Falta habilitación vigente.' } });
    expect(inline().getByText('Falta guardar en servidor.')).toBeInTheDocument();
    expect(inspeccionService.saveDraft).not.toHaveBeenCalled();
    fireEvent.click(inline().getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalledWith('inspection-1', expect.objectContaining({ version: 1, items: [{ id: 'item-1', resultado: 'NO_CUMPLE', observacion: 'Falta habilitación vigente.' }], comparaciones: [] })));
    expect(inspeccionService.saveDraft).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(inline().getByText('Guardado en servidor.')).toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Cambios confirmados en el servidor', expect.stringContaining('borrador completo'));
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toMatchObject({ version: 2, items: [{ observacion: 'Falta habilitación vigente.' }] });
  });

  it('reports device-only protection offline and never claims server confirmation', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Comentario sin señal.' } });
    fireEvent.click(inline().getByRole('button', { name: 'Guardar cambios' }));
    expect(inline().getByText(/Solo en este dispositivo/)).toBeInTheDocument();
    expect(inspeccionService.saveDraft).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key) || '{}').items[0].observacion).toBe('Comentario sin señal.');
  });

  it('blocks an app update while a field comment is still unsent', async () => {
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Trabajo pendiente antes de actualizar.' } });
    const event = new CustomEvent<{ reason?: string }>('sitrep:before-app-update', { cancelable: true, detail: {} });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(event.detail.reason).toMatch(/Guardá los cambios en el servidor/);
    expect(JSON.parse(localStorage.getItem(key) || '{}').items[0].observacion).toBe('Trabajo pendiente antes de actualizar.');
  });

  it('distinguishes an offline uncached case from a nonexistent case', () => {
    queryMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }), refetch: vi.fn() });
    render(page());
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión y sin copia local');
    expect(screen.queryByText('Inspección no encontrada')).not.toBeInTheDocument();
  });

  it('does not advertise an offline save when local storage is unavailable', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'No debe perderse.' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    fireEvent.click(inline().getByRole('button', { name: 'Guardar cambios' }));
    expect(inline().getByText(/No hay copia local confirmada/)).toBeInTheDocument();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo guardar', expect.stringContaining('solo en memoria'));
    expect(editor()).toHaveValue('No debe perderse.');
  });

  it('keeps the comment after server failure and shows retry feedback', async () => {
    vi.mocked(inspeccionService.saveDraft).mockRejectedValue(new Error('network unavailable'));
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Comentario conservado.' } });
    fireEvent.click(inline().getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(inline().getByText(/No se confirmó el guardado/)).toBeInTheDocument());
    expect(editor()).toHaveValue('Comentario conservado.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key) || '{}').items[0].observacion).toBe('Comentario conservado.');
  });

  it('handles an automatic local-backup failure without throwing or hiding the comment', async () => {
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Memoria sin respaldo.' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    await waitFor(() => expect(inline().getByText(/No hay copia local confirmada/)).toBeInTheDocument());
    expect(editor()).toHaveValue('Memoria sin respaldo.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('blocks repeated writes when another device advanced the server version', async () => {
    vi.mocked(inspeccionService.saveDraft).mockRejectedValue(new Error('version conflict'));
    queryMock.mockReturnValue({ data: fixture, isLoading: false, refetch: vi.fn().mockResolvedValue({ data: { ...fixture, version: 2 } }) });
    render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Comentario de una versión anterior.' } });
    fireEvent.click(inline().getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(inline().getByText(/Hay versiones en conflicto/)).toBeInTheDocument());
    expect(inline().getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(editor()).toHaveValue('Comentario de una versión anterior.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /recuperar borrador anterior/i })).toBeInTheDocument();
  });

  it('does not lose a later edit to save invalidation or mark it synchronized', async () => {
    let resolveSave!: (value: Inspection) => void;
    vi.mocked(inspeccionService.saveDraft).mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    const view = render(page());
    fireEvent.change(await screen.findByRole('textbox', { name: 'Observación: Documentación vigente' }), { target: { value: 'Primera versión.' } });
    fireEvent.click(inline().getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalled());
    expect(editor()).toBeDisabled();
    // Programmatic input models a queued input event landing during the save.
    fireEvent.change(editor(), { target: { value: 'Trabajo posterior.' } });
    queryMock.mockReturnValue({ data: { ...fixture, version: 4, items: [{ ...fixture.items[0], observacion: 'Primera versión.' }] }, isLoading: false, refetch: vi.fn() });
    view.rerender(page());
    expect(editor()).toHaveValue('Trabajo posterior.');
    await act(async () => resolveSave({ version: 4 } as Inspection));
    expect(editor()).toHaveValue('Trabajo posterior.');
    expect(inline().queryByText('Guardado en servidor.')).not.toBeInTheDocument();
    expect(inline().getByText(/Solo en este dispositivo/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toMatchObject({ version: 4, items: [{ observacion: 'Trabajo posterior.' }] });
  });
});
