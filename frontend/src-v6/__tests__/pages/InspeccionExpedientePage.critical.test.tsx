vi.mock('../../pages/inspecciones/InspectionLocationMap', () => ({ default: () => <div>Mapa de prueba</div> }));
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../hooks/useCatalogos', () => ({ useCatalogoGeneradores: () => ({ data: [] }), useCatalogoOperadores: () => ({ data: [] }), useCatalogoTransportistas: () => ({ data: [] }) }));
import type { Inspection, InspectionTechnicalReport } from '../../types/inspection';
import InspeccionExpedientePage from '../../pages/inspecciones/InspeccionExpedientePage';

import { inspectionFieldDraftKey, inspectionReturnState, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
function ReturnProbe() { const location = useLocation(); return <output aria-label="Destino de regreso">{location.pathname + location.search}</output>; }

const useInspectionMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/inspectionFieldCheckpoint', () => ({ readInspectionFieldCheckpoint: vi.fn().mockResolvedValue(undefined), writeInspectionFieldCheckpoint: vi.fn().mockResolvedValue(undefined) }));
const listPendingEvidenceMock = vi.hoisted(() => vi.fn());
const transitionMock = vi.hoisted(() => vi.fn());
const draftOwnershipMock = vi.hoisted(() => vi.fn());
const authContext = vi.hoisted(() => ({ rol: 'ADMIN' }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => draftOwnershipMock() }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'admin-1', rol: authContext.rol, nombre: 'Admin' } }),
}));

vi.mock('../../hooks/useInspecciones', () => ({
  useInspection: useInspectionMock,
  useInspectionExchanges: () => ({ data: null, isLoading: false, isError: false }),
  useInspectionMutation: (mutationFn: (input: unknown) => Promise<unknown>) => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn((input: unknown) => mutationFn(input)),
    isPending: false,
  }),
}));

vi.mock('../../services/inspeccion.service', () => ({
  inspeccionService: {
    update: vi.fn(),
    updateItems: vi.fn(),
    updateComparisons: vi.fn(),
    saveDraft: vi.fn().mockResolvedValue({ version: 8 }),
    updateTechnicalReport: vi.fn().mockResolvedValue({ version: 8 }),
    transition: transitionMock,
    uploadEvidence: vi.fn(),
    annulEvidence: vi.fn(),
    addEvent: vi.fn(),
    downloadPdf: vi.fn(),
  },
}));

vi.mock('../../services/inspectionOfflineEvidence', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/inspectionOfflineEvidence')>(),
  listPendingInspectionEvidence: listPendingEvidenceMock,
  pendingEvidenceFile: vi.fn(),
  queueInspectionEvidence: vi.fn(),
  removePendingInspectionEvidence: vi.fn(),
  updatePendingInspectionEvidence: vi.fn(),
}));

vi.mock('../../components/ui/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../pages/inspecciones/InspectionComparisonPanel', () => ({
  InspectionComparisonPanel: () => <section data-testid="comparison-editor">Comparativa</section>,
}));

vi.mock('../../pages/inspecciones/InspectionTimeline', () => ({
  InspectionTimeline: () => <section>Línea de tiempo</section>,
}));

// Tested on their own; the field sheet mounts them on every render and they need React Query.
vi.mock('../../pages/inspecciones/InspectionSignaturePanel', () => ({ InspectionSignaturePanel: () => <section>Firma</section> }));
vi.mock('../../pages/inspecciones/InspectionActAccessPanel', () => ({ InspectionActAccessPanel: () => <section>Copia del acta</section> }));

vi.mock('../../pages/inspecciones/InspectionEvidenceImage', () => ({
  InspectionEvidenceImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const completeReport: InspectionTechnicalReport = {
  expedienteElectronico: 'EX-2026-000001',
  referencias: 'Acta y evidencias del expediente.',
  objetivo: 'Evaluar el cumplimiento normativo.',
  antecedentes: 'Antecedentes documentados.',
  evaluacion: 'Evaluación técnica fundada.',
  conclusion: 'Conclusión técnica fundada.',
  recomendacion: 'Recomendación técnica fundada.',
};

function inspectionFixture(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'inspection-1',
    numero: 'I-2026-000001',
    numeroActa: 'ACTA-2026-001',
    tipoActor: 'GENERADOR',
    estado: 'EN_REVISION',
    inspectorId: 'inspector-1',
    inspector: { id: 'inspector-1', nombre: 'Ada', apellido: 'Inspectora' },
    generador: { id: 'generator-1', razonSocial: 'Planta Auditada SA', cuit: '30-12345678-9' },
    transportista: null,
    operador: null,
    ubicacion: 'Parque Industrial, Mendoza',
    fechaProgramada: '2026-09-20T12:00:00.000Z',
    iniciadaAt: '2026-09-20T12:15:00.000Z',
    cerradaCampoAt: '2026-09-20T15:00:00.000Z',
    plazoRespuestaAt: '2026-09-30T15:00:00.000Z',
    observaciones: 'Se documentó el alcance completo de la inspección.',
    datosActa: {
      area: 'Residuos Peligrosos',
      motivoInspeccion: 'Control programado',
      lugarAfectacion: 'Depósito de residuos',
      danosEstado: 'NO_OBSERVADOS',
      tercerosTestigosEstado: 'NO_IDENTIFICADOS',
      libroOperacionesEstado: 'EXHIBIDO',
      libroOperacionesDetalle: 'Libro identificado y verificado.',
      firmaIntervinienteEstado: 'FIRMADA',
      copiaActaEstado: 'ENTREGADA',
      copiaActaDetalle: 'Copia entregada a la persona responsable.',
      domicilioLegal: 'Parque Industrial, Mendoza',
      notificacionEstado: 'COMUNICADA_EN_ACTA',
      notificacionDetalle: 'Contenido, plazo y derechos informados en el acta.',
    },
    informeTecnico: completeReport,
    version: 7,
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-20T15:00:00.000Z',
    items: [{
      id: 'item-1', codigo: 'DOC-01', categoria: 'Documentación', etiqueta: 'Documentación obligatoria',
      orden: 1, obligatorio: true, resultado: 'CUMPLE', observacion: null, evidencias: [],
    }],
    comparaciones: [{
      id: 'comparison-1', codigo: 'REG-01', categoria: 'Registro', etiqueta: 'Habilitación', origen: 'registro',
      valorDeclarado: 'A-001', valorObservado: 'A-001', resultado: 'COINCIDE', observacion: null, orden: 1, evidencias: [],
    }],
    evidencias: [],
    eventos: [],
    ...overrides,
  };
}

function renderPage(inspection: Inspection, mobile = false, hash = '') {
  useInspectionMock.mockReturnValue({
    data: inspection,
    isLoading: false,
    refetch: vi.fn().mockResolvedValue({ data: inspection }),
  });
  const path = mobile ? `/mobile/inspecciones/${inspection.id}` : `/inspecciones/${inspection.id}`;
  return render(
    <MemoryRouter initialEntries={[path + hash]}>
      <Routes>
        <Route path="/inspecciones/:id" element={<InspeccionExpedientePage />} />
        <Route path="/mobile/inspecciones/:id" element={<InspeccionExpedientePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InspeccionExpedientePage critical review UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContext.rol = 'ADMIN';
    localStorage.clear();
    listPendingEvidenceMock.mockResolvedValue([]);
    draftOwnershipMock.mockReturnValue({ status: 'owned', canWrite: () => true, retry: vi.fn() });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('isolates unsaved field testimony when the same account changes role and recovers it on return', async () => {
    const inspection = inspectionFixture({ estado: 'EN_CAMPO' });
    useInspectionMock.mockReturnValue({ data: inspection, isLoading: false, refetch: vi.fn() });
    const page = () => <MemoryRouter initialEntries={['/inspecciones/inspection-1#acta']}><Routes><Route path="/inspecciones/:id" element={<InspeccionExpedientePage />} /></Routes></MemoryRouter>;
    const view = render(page());
    const field = await waitFor(() => { const input = view.container.querySelector<HTMLTextAreaElement>('#inspection-observations'); expect(input).toBeEnabled(); return input!; });
    fireEvent.change(field, { target: { value: 'Apunte exclusivo de administración general sin guardar aún.' } });
    authContext.rol = 'ADMIN_GENERADOR';
    view.rerender(page());
    await waitFor(() => expect(view.container.querySelector('#inspection-observations')).toHaveValue(inspection.observaciones));
    authContext.rol = 'ADMIN';
    view.rerender(page());
    await waitFor(() => expect(view.container.querySelector('#inspection-observations')).toHaveValue('Apunte exclusivo de administración general sin guardar aún.'));
  });

  it.each(['/inspecciones', '/mobile/inspecciones'])('returns to the selected agenda from the actual dossier at %s', async path => {
    const inspection = inspectionFixture();
    useInspectionMock.mockReturnValue({ data: inspection, isLoading: false, refetch: vi.fn() });
    const target = path + '?vista=agenda&agendaEstado=EN_DESCARGO&agendaPage=2';
    const state = inspectionReturnState(target, inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }));
    render(<MemoryRouter initialEntries={[{ pathname: path + '/inspection-1', state }]}><Routes><Route path={path + '/:id'} element={<InspeccionExpedientePage />} /><Route path={path} element={<ReturnProbe />} /></Routes></MemoryRouter>);
    const button = await screen.findByRole('button', { name: 'Volver a Agenda de inspecciones' });
    fireEvent.click(button);
    expect(await screen.findByLabelText('Destino de regreso')).toHaveTextContent(target);
  });

  it('names the return destination before the dossier identity, without nesting it in the title', async () => {
    renderPage(inspectionFixture({ estado: 'EN_CAMPO' }), true, '#checklist');
    const heading = await screen.findByRole('heading', { name: 'I-2026-000001', exact: true });
    expect(heading.tagName).toBe('H2'); // The shared shell owns the page's single h1.
    const header = heading.closest('header')!;
    const back = screen.getByRole('button', { name: 'Volver a Inspecciones', exact: true });
    expect(header.firstElementChild).toContainElement(back);
    expect(back).toHaveTextContent('Inspecciones');
    expect(header.firstElementChild).not.toContainElement(heading);
    expect(heading.parentElement?.parentElement).toContainElement(screen.getByRole('link', { name: 'Abrir actor inspeccionado: Planta Auditada SA', exact: true }));
  });

  it('saves the field sheet on its own after an edit, with no Guardar button and no step tabs', async () => {
    const { inspeccionService } = await import('../../services/inspeccion.service');
    const rendered = renderPage(inspectionFixture({ estado: 'EN_CAMPO' }), true);
    const editor = await waitFor(() => { const field = rendered.container.querySelector<HTMLTextAreaElement>('#inspection-observations'); expect(field).toBeEnabled(); return field!; });
    expect(screen.queryByRole('button', { name: /guardar/i })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Secciones del expediente' })).toBeNull();
    expect(screen.queryByTestId('inspection-action-bar')).toBeNull();
    expect(screen.getByTestId('inspection-field-status')).toHaveTextContent(/^Guardado \d{2}:\d{2}$/);
    fireEvent.change(editor, { target: { value: 'Comentario de campo guardado sin tocar ningún botón.' } });
    expect(screen.getByTestId('inspection-field-status')).toHaveTextContent('Guardando…');
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(inspeccionService.saveDraft).toHaveBeenCalledWith('inspection-1', expect.objectContaining({ observaciones: 'Comentario de campo guardado sin tocar ningún botón.' }));
    await waitFor(() => expect(screen.getByTestId('inspection-field-status')).toHaveTextContent(/^Guardado \d{2}:\d{2}$/));
    expect(editor).toHaveValue('Comentario de campo guardado sin tocar ningún botón.');
  });
  it('keeps the text after a refused save and retries only on the next edit', async () => {
    const { inspeccionService } = await import('../../services/inspeccion.service');
    vi.mocked(inspeccionService.saveDraft).mockRejectedValueOnce(new Error('offline'));
    const view = renderPage(inspectionFixture({ estado: 'EN_CAMPO' }), true);
    const editor = await waitFor(() => { const field = view.container.querySelector<HTMLTextAreaElement>('#inspection-observations'); expect(field).toBeEnabled(); return field!; });
    fireEvent.change(editor, { target: { value: 'Este texto debe sobrevivir a un fallo del servidor.' } });
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('inspection-field-status')).toHaveTextContent('No se confirmó el guardado'));
    expect(editor).toHaveValue('Este texto debe sobrevivir a un fallo del servidor.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(inspeccionService.saveDraft).toHaveBeenCalledTimes(1);
    fireEvent.change(editor, { target: { value: 'Este texto debe sobrevivir a un fallo del servidor. Corregido.' } });
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalledTimes(2), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('inspection-field-status')).toHaveTextContent(/^Guardado/));
  }, 15000);
  it('opens review first and keeps the technical report available separately', async () => {
    renderPage(inspectionFixture());
    expect(await screen.findByRole('region', { name: 'Revisar y enviar' })).toBeVisible();
    fireEvent.click(screen.getByText('Expediente y seguimiento', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('link', { name: 'Informe técnico', exact: true }));
    expect(await screen.findByRole('region', { name: /informe técnico para legales/i })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /vista consolidada del expediente/i })).toBeNull();
  });

  it('lists approval blockers and disables approval while the dossier is incomplete', async () => {
    renderPage(inspectionFixture({
      numeroActa: null,
      cerradaCampoAt: null,
      plazoRespuestaAt: null,
      observaciones: null,
      datosActa: {},
      informeTecnico: {},
      items: [{
        id: 'item-1', codigo: 'DOC-01', categoria: 'Documentación', etiqueta: 'Documentación obligatoria',
        orden: 1, obligatorio: true, resultado: 'PENDIENTE', observacion: null, evidencias: [],
      }],
      comparaciones: [{
        id: 'comparison-1', codigo: 'REG-01', categoria: 'Registro', etiqueta: 'Habilitación', origen: 'registro',
        valorDeclarado: 'A-001', valorObservado: null, resultado: 'PENDIENTE', observacion: null, orden: 1, evidencias: [],
      }],
    }), false, '#revision');

    const readiness = await screen.findByTestId('inspection-dossier-readiness');
    expect(within(readiness).getByRole('heading', { name: /pendientes de revisión administrativa/i })).toBeInTheDocument();
    expect(within(readiness).getByText(/número de acta/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/objetivo(?: del informe)? técnico/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/plazo de respuesta/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/daños a personas o bienes/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/libro de registro de operaciones/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/notificación y domicilio legal/i)).toBeInTheDocument();

    expect(within(readiness).getByRole('link', { name: 'Completar informe técnico' })).toHaveAttribute('href', '#informe-tecnico');
    expect(within(readiness).getByRole('link', { name: 'Consultar constancias de campo' })).toHaveAttribute('href', '#acta');
    const approve = screen.getByRole('button', { name: /aprobar expediente/i });
    expect(approve).toBeDisabled();
    fireEvent.click(approve);
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it('keeps a reviewed finding without a responsible actor editable as a report but never offers an impossible notification', async () => {
    renderPage(inspectionFixture({
      tipoActor: null,
      generador: null,
      comparaciones: [],
    }), false, '#revision');

    expect(await screen.findByText(/no hay destinatario para notificar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprobar expediente/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Plazo de respuesta')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devolver a campo/i })).toBeInTheDocument();
  });

  it('shows a clear read-only state and hides save and transition actions when another tab owns the draft', async () => {
    draftOwnershipMock.mockReturnValue({ status: 'blocked', canWrite: () => false, retry: vi.fn() });
    renderPage(inspectionFixture());

    expect(await screen.findByText('Otra pestaña está editando este expediente')).toBeInTheDocument();
    expect(screen.getByText(/Solo consulta: otra pestaña tiene el borrador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprobar expediente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /devolver a campo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar informe/i })).not.toBeInTheDocument();
  });

  it('preserves an older local draft and lets the reviewer recover it explicitly', async () => {
    const inspection = inspectionFixture();
    const key = inspectionFieldDraftKey('admin-1', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }), inspection.id);
    const olderDraft = {
      version: inspection.version - 1,
      observaciones: 'Trabajo local todavía no conciliado.',
      numeroActa: inspection.numeroActa,
      ubicacion: inspection.ubicacion,
      plazoRespuestaAt: '2026-09-30T12:00',
      datosActa: inspection.datosActa,
      informeTecnico: { ...completeReport, objetivo: 'Objetivo conservado en el borrador anterior.' },
      items: inspection.items,
      comparaciones: inspection.comparaciones,
    };
    localStorage.setItem(key, JSON.stringify(olderDraft));

    renderPage(inspection, false, '#informe-tecnico');

    const objectiveConflict = await screen.findByRole('checkbox', { name: /Informe · objetivo/i });
    expect(screen.getByRole('button', { name: /descartar borrador anterior/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toMatchObject({
      version: inspection.version - 1,
      informeTecnico: { objetivo: 'Objetivo conservado en el borrador anterior.' },
    });

    fireEvent.click(objectiveConflict);
    fireEvent.click(screen.getByRole('button', { name: /aplicar selección \(1\)/i }));
    expect(await screen.findByDisplayValue('Objetivo conservado en el borrador anterior.')).toBeInTheDocument();
  });

  it('locks field editing until the older local copy has been reconciled', async () => {
    const inspection = inspectionFixture({ estado: 'EN_CAMPO' });
    const key = inspectionFieldDraftKey('admin-1', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }), inspection.id);
    localStorage.setItem(key, JSON.stringify({ version: inspection.version - 1, observaciones: 'Texto pendiente que requiere elección.' }));
    const view = renderPage(inspection, false, '#acta');
    const choice = await screen.findByRole('checkbox', { name: /Observaciones generales/ });
    expect(view.container.querySelector('#inspection-observations')).toBeDisabled();
    fireEvent.click(choice);
    fireEvent.click(screen.getByRole('button', { name: /aplicar selección \(1\)/i }));
    await waitFor(() => expect(view.container.querySelector('#inspection-observations')).toBeEnabled());
    expect(view.container.querySelector('#inspection-observations')).toHaveValue('Texto pendiente que requiere elección.');
  });

  it.each([false, true])('does not block a saved case before local acknowledgment (JSON key reorder: %s)', async (reorderKeys) => {
    const inspection = inspectionFixture({ estado: 'EN_CAMPO', plazoRespuestaAt: null });
    const key = inspectionFieldDraftKey('admin-1', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }), inspection.id);
    localStorage.setItem(key, JSON.stringify({
      version: inspection.version - 1, observaciones: inspection.observaciones,
      numeroActa: inspection.numeroActa, ubicacion: inspection.ubicacion, plazoRespuestaAt: '',
      datosActa: reorderKeys ? Object.fromEntries(Object.entries(inspection.datosActa!).reverse()) : inspection.datosActa,
      informeTecnico: reorderKeys ? Object.fromEntries(Object.entries(inspection.informeTecnico!).reverse()) : inspection.informeTecnico,
      items: inspection.items, comparaciones: inspection.comparaciones,
    }));
    renderPage(inspection, false, '#acta');
    const field = await screen.findByLabelText('Registro de lo observado');
    expect(field).toHaveValue(inspection.observaciones);
    expect(screen.queryByText('Hay un borrador anterior sin conciliar')).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'Nuevo hallazgo después de recargar' } });
    expect(screen.getByTestId('inspection-field-status')).toHaveTextContent('Guardando…');
    fireEvent(window, new Event('pagehide'));
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toMatchObject({
      version: inspection.version, observaciones: 'Nuevo hallazgo después de recargar',
    });
  });

  it('removes an older local draft only after an explicit discard action', async () => {
    const inspection = inspectionFixture();
    const key = inspectionFieldDraftKey('admin-1', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }), inspection.id);
    localStorage.setItem(key, JSON.stringify({
      version: inspection.version - 1,
      observaciones: 'Borrador a descartar por decisión humana.',
      numeroActa: inspection.numeroActa,
      ubicacion: inspection.ubicacion,
      plazoRespuestaAt: '',
      datosActa: inspection.datosActa,
      informeTecnico: completeReport,
      items: inspection.items,
      comparaciones: inspection.comparaciones,
    }));

    renderPage(inspection);
    fireEvent.click(await screen.findByRole('button', { name: /descartar borrador anterior/i }));

    await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  });

  it('keeps mobile actions after the fields on the shared page scroll surface', async () => {
    renderPage(inspectionFixture(), true);

    const content = await screen.findByTestId('inspection-step-content');
    expect(content).toBeVisible();
    const actionBar = screen.queryByTestId('inspection-action-bar');
    if (!actionBar) { expect(screen.queryByRole('progressbar', { name: 'Paso actual del recorrido' })).toBeNull(); return; }
    const positioningContract = `${actionBar.className} ${actionBar.getAttribute('style') || ''}`;
    expect(positioningContract).not.toMatch(/\b(?:fixed|absolute)\b/);
    expect(actionBar.className).not.toMatch(/\b(sticky|fixed|absolute)\b/);
    const page = content.closest('[data-inspection-page-scroll]');
    expect(page).not.toBeNull();
    expect(page?.contains(actionBar)).toBe(false);
    expect(page?.parentElement).toContainElement(actionBar);
    expect(screen.getByTestId('inspection-scroll-region')).not.toHaveAttribute('data-inspection-scroll');
    expect(screen.getByTestId('inspection-navigation').className).not.toMatch(/\bsticky\b/);
    expect(content.compareDocumentPosition(actionBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: 'Paso actual del recorrido' })).toBeNull();
  });

  it('opens the checklist index without editable focus and searches only on explicit entry', async () => {
    renderPage(inspectionFixture({ estado: 'EN_CAMPO' }), true, '#checklist');
    const trigger = await screen.findByRole('button', { name: /^Ir a un control:/ });
    trigger.focus();
    fireEvent.click(trigger);
    const search = screen.getByRole('searchbox', { name: 'Buscar control' });
    expect(search).not.toHaveFocus();
    expect(screen.getByRole('navigation', { name: 'Índice de controles' })).toBeVisible();
    search.focus();
    fireEvent.change(search, { target: { value: 'obligatoria' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Índice de controles' })).getByRole('button', { name: /Documentación obligatoria/ }));
    expect(screen.queryByRole('searchbox', { name: 'Buscar control' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Observación: Documentación obligatoria' })).toBeVisible();
  });

  it('keeps every control on one list: answered cards open by content and nothing collapses on its own', async () => {
    const base = inspectionFixture({ estado: 'EN_CAMPO' });
    renderPage({ ...base, items: [...base.items, { ...base.items[0], id: 'item-2', codigo: 'DOC-02', etiqueta: 'Otro control', resultado: 'PENDIENTE' }] }, true);
    const first = await waitFor(() => { const card = document.getElementById('control-item-1'); expect(card).not.toBeNull(); return card!; });
    expect(first.querySelector('button[aria-expanded]')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Observación: Documentación obligatoria' })).toBeNull();
    fireEvent.click(within(first).getByRole('button', { name: 'Agregar observación o foto' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Observación: Documentación obligatoria' }), { target: { value: 'Nota en campo que no debe perderse' } });
    const second = document.getElementById('control-item-2')!;
    expect(second.querySelector('button[aria-expanded]')).toBeNull();
    fireEvent.click(within(second).getByRole('button', { name: 'No cumple' }));
    expect(screen.getByRole('textbox', { name: 'Observación: Otro control' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Observación: Documentación obligatoria' })).toHaveValue('Nota en campo que no debe perderse');
    expect(document.querySelectorAll('[id^="control-"] [aria-expanded]')).toHaveLength(0);
  });
  it('journals the field draft on the device and saves it to the server without any navigation', async () => {
    const { inspeccionService } = await import('../../services/inspeccion.service');
    const inspection = inspectionFixture({ estado: 'EN_CAMPO' });
    renderPage(inspection);
    fireEvent.change(await screen.findByLabelText('Ubicación', { exact: true }), { target: { value: 'Ubicación validada en campo' } });
    expect(screen.getByTestId('comparison-editor')).toBeVisible();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(inspectionFieldDraftKey('admin-1', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }), 'inspection-1')) || '{}')).toMatchObject({ ubicacion: 'Ubicación validada en campo' }));
    await waitFor(() => expect(inspeccionService.saveDraft).toHaveBeenCalledWith('inspection-1', expect.objectContaining({ ubicacion: 'Ubicación validada en campo' })), { timeout: 4000 });
  });
  it('offers the frozen declared location rather than a newer actor address and protects the explicit choice', async () => {
    const base = inspectionFixture({ estado: 'EN_CAMPO' });
    const inspection = { ...base, generador: { ...base.generador!, domicilio: 'Registro actualizado 999' },
      comparaciones: [{ ...base.comparaciones[0], codigo: 'CON-DOMICILIO', valorDeclarado: 'Registro fotografiado 100' }] };
    renderPage(inspection);
    const location = await screen.findByLabelText('Ubicación', { exact: true });
    expect(location).toHaveValue('Parque Industrial, Mendoza');
    expect(screen.queryByRole('button', { name: /Registro actualizado 999/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar domicilio declarado: Registro fotografiado 100' }));
    expect(location).toHaveValue('Registro fotografiado 100');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(inspectionFieldDraftKey('admin-1', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }), 'inspection-1')) || '{}')).toMatchObject({ ubicacion: 'Registro fotografiado 100' }));
  });

  it('shows one stage button: Iniciar visita before the visit, Enviar a revisión during it', async () => {
    const planned = renderPage(inspectionFixture({ estado: 'PLANIFICADA' }), true);
    expect(await screen.findByRole('button', { name: 'Iniciar visita' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar a revisión' })).toBeNull();
    for (const title of ['Estoy acá', 'Qué encontré', 'Controles', 'Cerrar la visita']) expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible();
    expect(screen.queryByText('Expediente y seguimiento')).toBeNull();
    planned.unmount();
    renderPage(inspectionFixture({ estado: 'EN_CAMPO' }), true);
    expect(await screen.findByRole('button', { name: 'Enviar a revisión' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Iniciar visita' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Expediente completo' })).toHaveAttribute('href', '/mobile/inspecciones/inspection-1?vista=expediente');
  });

  it('keeps the full dossier one link away from the field sheet', async () => {
    renderPage(inspectionFixture({ estado: 'EN_CAMPO' }), true, '?vista=expediente#checklist');
    expect(await screen.findByRole('region', { name: 'Recorrido de campo' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Secciones del expediente' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Formulario de campo' })).toHaveAttribute('href', '/mobile/inspecciones/inspection-1#checklist');
    expect(screen.queryByTestId('inspection-field-sheet')).toBeNull();
  });
});
