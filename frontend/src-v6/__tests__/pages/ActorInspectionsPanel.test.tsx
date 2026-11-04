import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActorInspectionsPanel } from '../../pages/inspecciones/ActorInspectionsPanel';

const mock = vi.hoisted(() => ({
  user: { id: 'admin', rol: 'ADMIN' } as { id: string; rol: string; actorId?: string; esInspector?: boolean },
  list: vi.fn(), refetch: vi.fn(), mode: 'online' as 'online' | 'offline' | 'error',
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user }) }));
vi.mock('../../hooks/useInspecciones', () => ({ useInspections: (params: any) => {
  mock.list(params);
  if (mock.mode === 'error') return { isError: true, refetch: mock.refetch };
  if (mock.mode === 'offline') return { data: { offline: true, items: [], total: 0, totalPages: 1 } };
  return { data: { total: 121, totalPages: 7, items: [{ id: `case-${params.page}`, numero: `QA-${params.page}`, estado: 'EN_CAMPO', inspector: { nombre: 'Inspectora' }, createdAt: '2026-10-20' }], summary: { byState: { EN_CAMPO: 90, CERRADA_CONFORME: 11, FINALIZADA: 10, CANCELADA: 10 } } } };
} }));

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}
function open(path = '/admin/actores/generadores/g-1?tab=inspecciones') {
  render(<MemoryRouter initialEntries={[path]}><Location /><ActorInspectionsPanel actorType="GENERADOR" actorId="g-1" actorName="QA Generador" /></MemoryRouter>);
}

describe('staff inspection history', () => {
  beforeEach(() => { mock.user = { id: 'admin', rol: 'ADMIN' }; mock.mode = 'online'; vi.clearAllMocks(); });
  it('uses counts from all states, not just the visible page, and retains pagination in the URL', () => {
    open();
    expect(screen.getByText('Total').parentElement).toHaveTextContent('121');
    expect(screen.getByText('Abiertas').parentElement).toHaveTextContent('90');
    expect(screen.getByText('Cerradas').parentElement).toHaveTextContent('31');
    expect(screen.queryByRole('button', { name: /nueva inspección/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /abrir listado completo/i })).not.toBeInTheDocument();
    expect(mock.list).toHaveBeenLastCalledWith({ tipoActor: 'GENERADOR', actorId: 'g-1', page: 1, limit: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=inspecciones&inspeccionesPagina=2');
    expect(screen.getByRole('link', { name: 'Abrir expediente QA-2' })).toBeVisible();
    expect(screen.getByText('Página 2 de 7')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=inspecciones');
  });
  it('clamps an obsolete page when the total becomes smaller', () => {
    open('/admin/actores/generadores/g-1?tab=inspecciones&inspeccionesPagina=99');
    expect(screen.getByTestId('location')).toHaveTextContent('inspeccionesPagina=7');
    expect(screen.getByText('Página 7 de 7')).toBeVisible();
  });
  it('identifies partial offline copies and does not present them as the complete history', () => {
    mock.mode = 'offline'; open();
    expect(screen.getByText(/historial puede estar incompleto/)).toHaveAttribute('role', 'status');
    expect(screen.getByText('Copias disponibles').parentElement).toHaveTextContent('0');
    expect(screen.getByText('No hay copias guardadas para este actor')).toBeVisible();
    expect(screen.queryByText('Abiertas')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin inspecciones asociadas')).not.toBeInTheDocument();
  });
  it('offers a retry rather than a misleading empty history on failure', () => {
    mock.mode = 'error'; open();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo recuperar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mock.refetch).toHaveBeenCalledOnce();
  });
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('never fetches the staff history for an ordinary %s', role => {
    mock.user = { id: 'actor', rol: role, actorId: 'g-1' }; open();
    expect(mock.list).not.toHaveBeenCalled();
    expect(screen.queryByText('Ver mis inspecciones')).not.toBeInTheDocument();
  });
  it('does not fetch another sector’s history for a sector administrator, even when marked inspector', () => {
    mock.user = { id: 'sector-admin', rol: 'ADMIN_TRANSPORTISTA', esInspector: true }; open();
    expect(mock.list).not.toHaveBeenCalled();
  });
});
