import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionOperationsPanel } from '../../pages/inspecciones/InspectionOperationsPanel';
import { canUseInspectionOperations, hasInspectionCoordinates } from '../../services/inspectionOperations.service';

const mocks = vi.hoisted(() => ({ query: vi.fn(), user: { id: 'i1', rol: 'ADMIN', esInspector: true }, exportList: vi.fn(), csv: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('../../hooks/useInspectionOperations', () => ({ useInspectionOperations: mocks.query }));
vi.mock('../../services/inspectionOperations.service', async (original) => ({ ...await original<typeof import('../../services/inspectionOperations.service')>(), inspectionOperationsService: { list: mocks.exportList } }));
vi.mock('../../utils/exportCsv', () => ({ downloadCsv: mocks.csv }));
const row = { id: 'case1', numero: 'IRP-2026-00001', estado: 'PLANIFICADA', tipoActor: null, inspector: { id: 'i1', nombre: 'Inspectora' }, fechaProgramada: '2026-09-25T12:00:00Z', createdAt: '2026-09-24T12:00:00Z', updatedAt: '2026-09-24T12:00:00Z' };
const result = { items: [row], total: 1, totalPages: 1, page: 1, limit: 10, summary: { byState: { PLANIFICADA: 1 }, sinResponsable: 1, sinUbicacion: 1 }, updatedAt: '2026-09-24T12:00:00Z' };
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'i1', rol: 'ADMIN', esInspector: true }; mocks.query.mockReturnValue({ data: result, isLoading: false, isError: false, refetch: vi.fn() }); });

describe('inspection operations across surfaces', () => {
  it('keeps unidentified cases visible and links to the same mobile dossier', () => {
    render(<MemoryRouter initialEntries={['/mobile/centro-control']}><InspectionOperationsPanel /></MemoryRouter>);
    expect(screen.getByText('Responsable por identificar')).toBeVisible();
    expect(screen.getByRole('link', { name: /IRP-2026-00001/ })).toHaveAttribute('href', '/mobile/inspecciones/case1');
    expect(screen.getByText(/1 sin responsable/)).toBeVisible();
  });
  it('applies an explicit scheduled-date basis for reports', () => {
    render(<MemoryRouter><InspectionOperationsPanel mode="report" desde="2026-09-01" hasta="2026-09-30" /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Fecha del reporte de inspecciones'), { target: { value: 'programada' } });
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ fecha: 'programada', activas: false, desde: '2026-09-01' }));
  });
  it('requests a complete scoped export rather than exporting the displayed page', async () => {
    mocks.exportList.mockResolvedValue({ ...result, total: 2, items: [row, { ...row, id: 'case2', numero: 'IRP-2026-00002', ubicacion: '=1+1' }] });
    render(<MemoryRouter><InspectionOperationsPanel mode="report" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV completo' }));
    await waitFor(() => expect(mocks.csv).toHaveBeenCalled());
    expect(mocks.exportList).toHaveBeenCalledWith(expect.objectContaining({ activas: false }), true);
    expect(mocks.csv.mock.calls[0][0]).toHaveLength(2);
    expect(mocks.csv.mock.calls[0][0][1].Lugar).toBe("'=1+1");
  });
  it('does not turn an unavailable response into a zero count', () => {
    mocks.query.mockReturnValue({ data: undefined, isError: true, refetch: vi.fn() });
    render(<MemoryRouter><InspectionOperationsPanel /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('No significa que no existan inspecciones');
    expect(screen.queryByText('0 legajos')).toBeNull();
  });
  it('does not render staff content for an ordinary actor', () => {
    mocks.user = { id: 'g1', rol: 'GENERADOR', esInspector: false };
    const { container } = render(<MemoryRouter><InspectionOperationsPanel /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement(); expect(canUseInspectionOperations(mocks.user)).toBe(false);
  });
  it('maps only complete valid coordinates, including zero', () => {
    expect(hasInspectionCoordinates({ latitud: 0, longitud: 0 })).toBe(true);
    expect(hasInspectionCoordinates({ latitud: -32, longitud: null })).toBe(false);
    expect(hasInspectionCoordinates({ latitud: Number.NaN, longitud: -68 })).toBe(false);
  });
});
