import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InspeccionesPage from '../../pages/inspecciones/InspeccionesPageV2';
import { saveInspectionResume } from '../../services/inspectionResume';
import type { Inspection } from '../../types/inspection';

const mocks = vi.hoisted(() => ({ useInspections: vi.fn(), refetch: vi.fn() }));
vi.mock('../../hooks/useInspectionOperations', () => ({ useInspectionOperations: () => ({ data: undefined, isLoading: false, isError: false }) }));
vi.mock('../../pages/inspecciones/InspectionIntakePanel', () => ({
  InspectionIntakePanel: () => <section aria-label="Antecedentes para inspección">Administración evalúa</section>,
}));
vi.mock('../../services/inspectionOperations.service', async (original) => ({ ...await original<typeof import('../../services/inspectionOperations.service')>(), inspectionOperationsService: { inspectors: vi.fn().mockResolvedValue([]) } }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'admin-1', rol: 'ADMIN', esInspector: false }, isAdmin: true }),
}));

vi.mock('../../hooks/useInspecciones', () => ({
  useInspections: mocks.useInspections,
  useInspectionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogoGeneradores: () => ({ data: [
    { id: 'g-1', razonSocial: 'Generador de prueba', domicilio: 'Registro 100', domicilioRealCalle: 'Planta 200', domicilioRealLocalidad: 'Las Heras', domicilioLegalCalle: 'Oficina 300', domicilioLegalDepto: 'Capital' },
    { id: 'g-2', razonSocial: 'Otro generador', domicilio: 'Otro 400' },
  ] }),
  useCatalogoTransportistas: () => ({ data: [] }),
  useCatalogoOperadores: () => ({ data: [] }),
}));

function NavigationProbe() {
  const location = useLocation(), navigate = useNavigate();
  return <><output aria-label="Ruta actual">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Atrás en navegador</button><button onClick={() => navigate('?vista=antecedentes')}>Abrir aviso de antecedente</button></>;
}

describe('InspeccionesPage', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    mocks.useInspections.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false, isError: false, refetch: mocks.refetch });
  });

  it.each(['/inspecciones', '/mobile/inspecciones'])('keeps antecedents within Inspecciones and restores the filtered list at %s', (path) => {
    render(<MemoryRouter initialEntries={[path + '?search=QA&etapa=SEGUIMIENTO']}><InspeccionesPage /><NavigationProbe /></MemoryRouter>);
    const expedientes = screen.getByRole('link', { name: 'Expedientes', exact: true });
    const antecedentes = screen.getByRole('link', { name: 'Antecedentes', exact: true });
    expect(expedientes).toHaveAttribute('aria-current', 'page');
    fireEvent.click(antecedentes);
    expect(antecedentes).toHaveAttribute('aria-current', 'page');
    expect(expedientes).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('region', { name: 'Antecedentes para inspección' })).toBeVisible();
    const url = new URL(screen.getByLabelText('Ruta actual').textContent!, 'https://qa.invalid');
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get('search')).toBe('QA');
    expect(url.searchParams.get('etapa')).toBe('SEGUIMIENTO');
    expect(url.searchParams.get('vista')).toBe('antecedentes');
    expect(screen.queryByLabelText('Buscar inspección')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás en navegador' }));
    expect(expedientes).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Buscar inspección')).toHaveValue('QA');
    expect(screen.queryByRole('region', { name: 'Antecedentes para inspección' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir aviso de antecedente' }));
    expect(antecedentes).toHaveAttribute('aria-current', 'page');
  });

  it('separates agenda from the full list and restores list filters when returning', () => {
    render(<MemoryRouter initialEntries={['/inspecciones?search=QA&etapa=SEGUIMIENTO&page=2']}><InspeccionesPage /><NavigationProbe /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Agenda', exact: true }));
    expect(screen.getByRole('link', { name: 'Agenda', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'Operación de inspecciones' })).toBeVisible();
    expect(screen.queryByLabelText('Buscar inspección')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Etapas PSIP' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Expedientes', exact: true }));
    expect(screen.getByLabelText('Buscar inspección')).toHaveValue('QA');
    expect(mocks.useInspections).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, search: 'QA' }));
    expect(screen.queryByRole('region', { name: 'Operación de inspecciones' })).toBeNull();
  });

  it('opens a notice directly in the selected section and retains navigation after re-entry', () => {
    render(<MemoryRouter initialEntries={['/inspecciones?vista=antecedentes']}><InspeccionesPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Antecedentes', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Volver a inspecciones' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Expedientes', exact: true }));
    expect(screen.getByRole('navigation', { name: 'Secciones de Inspecciones' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Etapas PSIP' })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Antecedentes', exact: true }));
    expect(screen.getByRole('region', { name: 'Antecedentes para inspección' })).toBeVisible();
  });

  it('filters the full follow-up phase and narrows its detailed states', () => {
    mocks.useInspections.mockReturnValue({ data: { items: [], total: 0, summary: { byState: { NOTIFICADA: 8, EN_DESCARGO: 2, REQUIERE_SUBSANACION: 3, CERRADA_CONFORME: 7 } } }, refetch: mocks.refetch });
    render(<MemoryRouter initialEntries={['/inspecciones?page=3']}><InspeccionesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Seguimiento 13' }));
    expect(mocks.useInspections).toHaveBeenLastCalledWith(expect.objectContaining({ estados: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'], estado: undefined, page: 1 }));
    expect(screen.queryByRole('option', { name: 'Cerrada conforme' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'EN_DESCARGO' } });
    expect(mocks.useInspections).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'EN_DESCARGO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerradas 7' }));
    expect(mocks.useInspections).toHaveBeenLastCalledWith(expect.objectContaining({ estados: ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'], estado: undefined }));
  });

  it('shows the empty state and opens the actor-aware creation form', () => {
    render(<MemoryRouter initialEntries={['/inspecciones']}><InspeccionesPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Inspecciones' })).toBeInTheDocument();
    expect(screen.getByText('No hay inspecciones para estos filtros')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /nueva inspección/i }));
    expect(screen.getByRole('dialog', { name: 'Nueva inspección' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Generador de prueba' })).toBeInTheDocument();
  });

  it('does not present a failed request as an empty registry', () => {
    mocks.useInspections.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.refetch });
    render(<MemoryRouter initialEntries={['/inspecciones']}><InspeccionesPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el listado');
    expect(screen.queryByText('No hay inspecciones para estos filtros')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it('offers the selected generator real, registered and legal addresses without choosing for the inspector', () => {
    render(<MemoryRouter><InspeccionesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva inspección' }));
    fireEvent.change(screen.getByLabelText('Actor inspeccionado'), { target: { value: 'g-1' } });
    const location = screen.getByLabelText('Ubicación prevista');
    expect(location).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Usar domicilio declarado: Registro 100' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar domicilio legal: Oficina 300, Capital' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar domicilio real: Planta 200, Las Heras' }));
    expect(location).toHaveValue('Planta 200, Las Heras');
  });

  it('keeps the written location when the inspected actor changes and drops stale suggestions', () => {
    render(<MemoryRouter><InspeccionesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva inspección' }));
    fireEvent.change(screen.getByLabelText('Actor inspeccionado'), { target: { value: 'g-1' } });
    fireEvent.change(screen.getByLabelText('Ubicación prevista'), { target: { value: 'Portón norte constatado' } });
    fireEvent.change(screen.getByLabelText('Actor inspeccionado'), { target: { value: 'g-2' } });
    expect(screen.getByLabelText('Ubicación prevista')).toHaveValue('Portón norte constatado');
    expect(screen.queryByRole('button', { name: /Registro 100|Planta 200/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar domicilio declarado: Otro 400' })).toBeInTheDocument();
  });

  it('does not offer a previously selected actor address for an unidentified finding', () => {
    render(<MemoryRouter><InspeccionesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva inspección' }));
    fireEvent.change(screen.getByLabelText('Actor inspeccionado'), { target: { value: 'g-1' } });
    expect(screen.getByRole('group', { name: 'Direcciones declaradas' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Responsable todavía sin identificar'));
    expect(screen.queryByRole('group', { name: 'Direcciones declaradas' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ubicación prevista')).toHaveValue('');
  });

  it('separates inspection classification from the responsible actor and explains the official number', () => {
    render(<MemoryRouter initialEntries={['/inspecciones']}><InspeccionesPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva inspección' }));
    const type = screen.getByLabelText('Tipo de inspección');
    expect(screen.getByRole('option', { name: /Petróleo · PRP/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Aire · ARP/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Espontánea.*IRP/ })).toBeInTheDocument();
    fireEvent.change(type, { target: { value: 'PETROLEO' } });
    expect(screen.getByText(/PRP-\d{4}-00001/)).toBeInTheDocument();
    expect(screen.getByLabelText('Responsable todavía sin identificar')).toBeChecked();
    expect(screen.queryByLabelText('Actor inspeccionado')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /D · Reservada/ })).toBeDisabled();
  });

  it('distinguishes local copies and resumes at the last inspected control', () => {
    const inspection = {
      id: 'inspection-1', numero: 'I-2026-000001', numeroActa: null, estado: 'EN_CAMPO', tipoActor: 'GENERADOR',
      inspector: { id: 'admin-1', nombre: 'Inspectora' }, generador: { id: 'actor-1', razonSocial: 'Planta QA', cuit: '30-12345678-9' },
      updatedAt: '2026-09-22T12:00:00.000Z', createdAt: '2026-09-22T12:00:00.000Z', items: [], comparaciones: [], evidencias: [], eventos: [],
    } as Inspection;
    saveInspectionResume('admin-1', 'inspection-1', '#checklist/DOC-01', 'Checklist regulatorio · Documentación vigente', inspectionWorkspaceOwner({ id: 'admin-1', rol: 'ADMIN' }));
    mocks.useInspections.mockReturnValue({ data: { items: [inspection], total: 1, totalPages: 1, offline: true }, isLoading: false, isError: false, refetch: mocks.refetch });
    render(<MemoryRouter initialEntries={['/inspecciones']}><InspeccionesPage /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión · copias de este dispositivo');
    expect(screen.getByRole('link', { name: /Retomar expediente I-2026-000001/ })).toHaveAttribute('href', '/inspecciones/inspection-1#checklist/DOC-01');
    expect(screen.getByRole('button', { name: 'Nueva inspección' })).toBeDisabled();
    expect(screen.queryByText('No hay inspecciones para estos filtros')).not.toBeInTheDocument();
  });
});
