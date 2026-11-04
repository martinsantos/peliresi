import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileDashboardPage } from '../../../pages/mobile/MobileDashboardPage';
import { saveInspectionResume } from '../../../services/inspectionResume';
import { inspectionWorkspaceOwner } from '../../../utils/inspectionWorkspace';

const navigateMock = vi.hoisted(() => vi.fn());
const mocks = vi.hoisted(() => ({ useInspections: vi.fn(), refetch: vi.fn() }));
const inspector = { id: 'insp-1', rol: 'ADMIN', esInspector: true, esJefeInspecciones: false, nombre: 'Inspectora de práctica' };

vi.mock('react-router-dom', async (importOriginal) => ({ ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => navigateMock }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: inspector }) }));
vi.mock('../../../hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOnline: true, isApiReachable: true }) }));
vi.mock('../../../hooks/useInspecciones', () => ({ useInspections: mocks.useInspections }));

const row = (id: string, numero: string, estado: string, inspectorId: string, extra: Record<string, unknown> = {}) => ({
  id, numero, estado, inspectorId, inspector: { id: inspectorId, nombre: 'Inspector' }, tipoActor: 'GENERADOR',
  generador: { id: 'g-1', razonSocial: 'Planta QA' }, createdAt: '2026-11-03T12:00:00.000Z', updatedAt: '2026-11-03T12:00:00.000Z', ...extra,
});

describe('Inicio del inspector', () => {
  beforeEach(() => {
    localStorage.clear(); navigateMock.mockClear(); mocks.useInspections.mockReset();
    mocks.useInspections.mockReturnValue({ data: { items: [
      row('plan-2', 'GRP-2026-00003', 'PLANIFICADA', 'insp-1', { fechaProgramada: '2026-11-06T13:00:00.000Z' }),
      row('otro-1', 'GRP-2026-00004', 'EN_CAMPO', 'insp-9', { iniciadaAt: '2026-11-03T10:00:00.000Z' }),
      row('campo-1', 'GRP-2026-00001', 'EN_CAMPO', 'insp-1', { iniciadaAt: '2026-11-03T11:00:00.000Z', ubicacion: 'Parque industrial' }),
      row('plan-1', 'GRP-2026-00002', 'PLANIFICADA', 'insp-1', { fechaProgramada: '2026-11-04T13:00:00.000Z' }),
    ], total: 4 }, isLoading: false, isError: false, refetch: mocks.refetch });
  });

  it('shows today\'s own field and scheduled inspections instead of manifest totals', () => {
    saveInspectionResume('insp-1', 'campo-1', '#checklist/DOC-01', 'Controles · Documentación', inspectionWorkspaceOwner({ id: 'insp-1', rol: 'ADMIN', esInspector: true }));
    render(<MemoryRouter initialEntries={['/dashboard']}><MobileDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(mocks.useInspections).toHaveBeenCalledWith(expect.objectContaining({ estados: ['EN_CAMPO', 'PLANIFICADA'] }));
    expect(screen.queryByText('Resumen de manifiestos')).not.toBeInTheDocument();
    expect(screen.queryByText(/Manifiestos/)).not.toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /expediente/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/inspecciones/campo-1#checklist/DOC-01', '/inspecciones/plan-1', '/inspecciones/plan-2']);
    expect(links[0]).toHaveAccessibleName('Retomar expediente GRP-2026-00001 en Controles · Documentación');
    expect(screen.queryByText('GRP-2026-00004')).not.toBeInTheDocument();
    expect(screen.getByText('1 en campo · 2 programadas')).toBeInTheDocument();
    expect(screen.getByText('Parque industrial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspecciones' }));
    expect(navigateMock).toHaveBeenCalledWith('/inspecciones');
  });

  it('keeps the mobile prefix and reports a failed query instead of an empty day', () => {
    mocks.useInspections.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.refetch });
    render(<MemoryRouter initialEntries={['/mobile/dashboard']}><MobileDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron consultar tus inspecciones');
    expect(screen.queryByText('Sin inspecciones en campo ni programadas')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Inspecciones' }));
    expect(navigateMock).toHaveBeenCalledWith('/mobile/inspecciones');
  });
});
