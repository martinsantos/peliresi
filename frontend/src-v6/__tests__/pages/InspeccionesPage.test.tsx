import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InspeccionesPage from '../../pages/inspecciones/InspeccionesPageV2';
import { saveInspectionResume } from '../../services/inspectionResume';
import type { Inspection } from '../../types/inspection';

const mocks = vi.hoisted(() => ({ useInspections: vi.fn(), refetch: vi.fn() }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'admin-1', rol: 'ADMIN', esInspector: false }, isAdmin: true }),
}));

vi.mock('../../hooks/useInspecciones', () => ({
  useInspections: mocks.useInspections,
  useInspectionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogoGeneradores: () => ({ data: [{ id: 'g-1', razonSocial: 'Generador de prueba' }] }),
  useCatalogoTransportistas: () => ({ data: [] }),
  useCatalogoOperadores: () => ({ data: [] }),
}));

describe('InspeccionesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.useInspections.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false, isError: false, refetch: mocks.refetch });
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

  it('distinguishes local copies and resumes at the last inspected control', () => {
    const inspection = {
      id: 'inspection-1', numero: 'I-2026-000001', numeroActa: null, estado: 'EN_CAMPO', tipoActor: 'GENERADOR',
      inspector: { id: 'admin-1', nombre: 'Inspectora' }, generador: { id: 'actor-1', razonSocial: 'Planta QA', cuit: '30-12345678-9' },
      updatedAt: '2026-09-22T12:00:00.000Z', createdAt: '2026-09-22T12:00:00.000Z', items: [], comparaciones: [], evidencias: [], eventos: [],
    } as Inspection;
    saveInspectionResume('admin-1', 'inspection-1', '#checklist/DOC-01', 'Checklist regulatorio · Documentación vigente');
    mocks.useInspections.mockReturnValue({ data: { items: [inspection], total: 1, totalPages: 1, offline: true }, isLoading: false, isError: false, refetch: mocks.refetch });
    render(<MemoryRouter initialEntries={['/inspecciones']}><InspeccionesPage /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión · copias de este dispositivo');
    expect(screen.getByRole('link', { name: /Retomar expediente I-2026-000001/ })).toHaveAttribute('href', '/inspecciones/inspection-1#checklist/DOC-01');
    expect(screen.getByRole('button', { name: 'Nueva inspección' })).toBeDisabled();
    expect(screen.queryByText('No hay inspecciones para estos filtros')).not.toBeInTheDocument();
  });
});
