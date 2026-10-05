import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TransportistaDetallePage from '../../pages/actores/TransportistaDetallePage';
import OperadorDetallePage from '../../pages/actores/OperadorDetallePage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: false, currentUser: { rol: 'GENERADOR', esInspector: true } }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {} } }) }));
vi.mock('../../pages/inspecciones/ActorInspectionsPanel', () => ({ ActorInspectionsPanel: () => null }));
vi.mock('../../components/TrazabilidadTimeline', () => ({ default: () => null }));
vi.mock('../../hooks/useActores', () => ({
  useTransportista: () => ({ data: { id: 'qa', razonSocial: 'QA Transporte', cuit: 'QA', activo: true, vehiculos: [], choferes: [] }, isLoading: false }),
  useOperador: () => ({ data: { id: 'qa', razonSocial: 'QA Operador', cuit: 'QA', activo: true, tratamientos: [] }, isLoading: false }),
  useCreateVehiculo: () => ({}), useCreateChofer: () => ({}), useUpdateVehiculo: () => ({}), useDeleteVehiculo: () => ({}),
  useUpdateChofer: () => ({}), useDeleteChofer: () => ({}),
}));

describe('Actor fichas use the same identity as operational maps', () => {
  it.each([
    ['transportista', 'QA Transporte', 'truck', '#ea580c', TransportistaDetallePage],
    ['operador', 'QA Operador', 'flask-conical', '#2563eb', OperadorDetallePage],
  ] as const)('%s header has the canonical glyph, color and independent background', (category, name, glyph, color, Component) => {
    const { container } = render(<MemoryRouter initialEntries={['/actors/qa']}><Routes><Route path="/actors/:id" element={<Component />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name, exact: true })).toBeVisible();
    const symbol = container.querySelector(`[data-map-symbol="${category}"]`);
    expect(symbol).not.toBeNull();
    expect(symbol!.querySelector('[data-map-symbol-background]')).toHaveStyle({ backgroundColor: color });
    expect(symbol!.querySelector(`svg.lucide-${glyph}`)).not.toBeNull();
    expect(symbol!.querySelector('svg')).toHaveClass('text-white');
    expect((symbol!.querySelector('svg') as SVGElement).style.transform).toBe('');
  });
});
