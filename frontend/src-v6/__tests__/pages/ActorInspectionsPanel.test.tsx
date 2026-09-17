import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ActorInspectionsPanel } from '../../pages/inspecciones/ActorInspectionsPanel';

vi.mock('../../hooks/useInspecciones', () => ({
  useInspections: () => ({
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
  }),
}));

describe('ActorInspectionsPanel', () => {
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
});
