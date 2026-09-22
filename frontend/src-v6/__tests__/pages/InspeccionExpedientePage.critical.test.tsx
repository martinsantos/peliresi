import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Inspection, InspectionTechnicalReport } from '../../types/inspection';
import InspeccionExpedientePage from '../../pages/inspecciones/InspeccionExpedientePage';

const useInspectionMock = vi.hoisted(() => vi.fn());
const listPendingEvidenceMock = vi.hoisted(() => vi.fn());
const transitionMock = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'admin-1', rol: 'ADMIN', nombre: 'Admin' } }),
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
    updateTechnicalReport: vi.fn().mockResolvedValue({ version: 8 }),
    transition: transitionMock,
    uploadEvidence: vi.fn(),
    annulEvidence: vi.fn(),
    addEvent: vi.fn(),
    downloadPdf: vi.fn(),
  },
}));

vi.mock('../../services/inspectionOfflineEvidence', () => ({
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

function renderPage(inspection: Inspection, mobile = false) {
  useInspectionMock.mockReturnValue({
    data: inspection,
    isLoading: false,
    refetch: vi.fn().mockResolvedValue({ data: inspection }),
  });
  const path = mobile ? `/mobile/inspecciones/${inspection.id}` : `/inspecciones/${inspection.id}`;
  return render(
    <MemoryRouter initialEntries={[path]}>
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
    localStorage.clear();
    listPendingEvidenceMock.mockResolvedValue([]);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('prioritizes the editable technical report before the consolidated view during review', async () => {
    renderPage(inspectionFixture());

    const editor = await screen.findByRole('heading', { name: /informe técnico para legales/i });
    const consolidated = screen.getByRole('heading', { name: /vista consolidada del expediente/i });
    expect(editor.compareDocumentPosition(consolidated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    }));

    const readiness = await screen.findByTestId('inspection-dossier-readiness');
    expect(within(readiness).getByRole('heading', { name: /preparación para aprobar/i })).toBeInTheDocument();
    expect(within(readiness).getByText(/número de acta/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/objetivo(?: del informe)? técnico/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/plazo de respuesta/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/daños a personas o bienes/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/libro de registro de operaciones/i)).toBeInTheDocument();
    expect(within(readiness).getByText(/notificación y domicilio legal/i)).toBeInTheDocument();

    const approve = screen.getByRole('button', { name: /aprobar expediente/i });
    expect(approve).toBeDisabled();
    fireEvent.click(approve);
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it('preserves an older local draft and lets the reviewer recover it explicitly', async () => {
    const inspection = inspectionFixture();
    const key = `sitrep_inspection_draft_admin-1_${inspection.id}`;
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

    renderPage(inspection);

    const recover = await screen.findByRole('button', { name: /recuperar borrador anterior/i });
    expect(screen.getByRole('button', { name: /descartar borrador anterior/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toMatchObject({
      version: inspection.version - 1,
      informeTecnico: { objetivo: 'Objetivo conservado en el borrador anterior.' },
    });

    fireEvent.click(recover);
    expect(await screen.findByDisplayValue('Objetivo conservado en el borrador anterior.')).toBeInTheDocument();
  });

  it('removes an older local draft only after an explicit discard action', async () => {
    const inspection = inspectionFixture();
    const key = `sitrep_inspection_draft_admin-1_${inspection.id}`;
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

  it('keeps the mobile action bar sticky below the device safe area', async () => {
    renderPage(inspectionFixture(), true);

    const actionBar = await screen.findByTestId('inspection-action-bar');
    const positioningContract = `${actionBar.className} ${actionBar.getAttribute('style') || ''}`;
    expect(positioningContract).toMatch(/\bsticky\b/);
    expect(positioningContract).toMatch(/safe-area-inset-top/);
  });
});
