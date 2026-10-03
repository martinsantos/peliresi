import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActorInspectionsPanel } from '../../pages/inspecciones/ActorInspectionsPanel';

const state = vi.hoisted(() => ({ role: 'ADMIN', inspector: false, actorId: 'g-1', query: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { rol: state.role, esInspector: state.inspector, actorId: state.actorId } }) }));

vi.mock('../../hooks/useInspecciones', () => ({
  useInspections: (...args: unknown[]) => { state.query(...args); return ({
    isLoading: false,
    isError: false,
    data: {
      total: 1,
      items: [{
        id: 'inspection-1', numero: 'I-2026-000001', numeroActa: 'ACTA-001', estado: 'EN_REVISION',
        tipoActor: 'GENERADOR', fechaProgramada: '2026-09-17T13:00:00.000Z', iniciadaAt: null,
        createdAt: '2026-09-17T12:00:00.000Z', ubicacion: 'Planta principal',
        inspector: { nombre: 'Marcia', apellido: 'Ardengo' },
      }],
    },
  }); },
}));

describe('ActorInspectionsPanel', () => {
  beforeEach(() => { state.role = 'ADMIN'; state.inspector = false; state.actorId = 'g-1'; state.query.mockClear(); });
  it('embeds linked history without duplicating create or list actions', () => {
    render(
      <MemoryRouter initialEntries={['/admin/actores/generadores/g-1']}>
        <ActorInspectionsPanel actorType="GENERADOR" actorId="g-1" actorName="Generador Alfa" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Inspecciones de Generador Alfa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir expediente I-2026-000001' })).toHaveAttribute('href', '/inspecciones/inspection-1');
    expect(screen.queryByRole('button', { name: /nueva inspección/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /abrir listado completo/i })).not.toBeInTheDocument();
  });
  it('sends an ordinary actor to participation without issuing a forbidden staff query', () => {
    state.role = 'GENERADOR';
    render(<MemoryRouter><ActorInspectionsPanel actorType="GENERADOR" actorId="g-1" actorName="Generador Alfa" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Ver mis inspecciones', exact: true })).toHaveAttribute('href', '/mis-inspecciones');
    expect(state.query).not.toHaveBeenCalled();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });
  it('does not label another sector\'s inspections as the consulted actor\'s history', () => {
    state.role = 'ADMIN_GENERADOR'; state.inspector = true;
    const { container } = render(<MemoryRouter><ActorInspectionsPanel actorType="OPERADOR" actorId="o-1" actorName="Operador Alfa" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    expect(state.query).not.toHaveBeenCalled();
  });
});
