import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ViajesPanel } from '../../pages/centro-control/components/ViajesPanel';
import type { EnTransitoItem } from '../../hooks/useCentroControl';

function Panel({ trips = [], initialFilter = '' }: { trips?: EnTransitoItem[]; initialFilter?: string } = {}) {
  const [panel, setPanel] = useState<'activos' | 'realizados' | 'inspecciones' | null>('activos');
  const [filter, setFilter] = useState(initialFilter);
  return <ViajesPanel inspections={[]} filteredEnTransito={trips} viajesRealizados={[]} tripFilter={filter} onTripFilterChange={setFilter} tripPanel={panel} onTripPanelChange={setPanel} selectedTripId={null} onSelectTrip={vi.fn()} selectedRealizadoId={null} onSelectRealizado={vi.fn()} viajesRef={{ current: null }} />;
}

describe('Centro de Control collapsible trip panels', () => {
  it.each(['Viajes Activos', 'Viajes Realizados', 'Inspecciones'])('can close %s without opening another panel', (name) => {
    render(<MemoryRouter><Panel /></MemoryRouter>);
    const header = screen.getByRole('button', { name: new RegExp('^' + name) });
    if (name !== 'Viajes Activos') fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(1);
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(0);
    expect(screen.queryByPlaceholderText('Buscar por número o transportista...')).toBeNull();
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(1);
  });

  it('preserves a typed trip filter across closing and reopening while changing panels remains exclusive', () => {
    render(<MemoryRouter><Panel /></MemoryRouter>);
    const active = screen.getByRole('button', { name: /^Viajes Activos/ });
    const completed = screen.getByRole('button', { name: /^Viajes Realizados/ });
    fireEvent.change(screen.getByPlaceholderText('Buscar por número o transportista...'), { target: { value: 'QA Viaje' } });
    expect(active).toHaveTextContent('0 filtrados');
    fireEvent.click(active);
    expect(active).toHaveTextContent('0 filtrados');
    fireEvent.click(active);
    expect(screen.getByPlaceholderText('Buscar por número o transportista...')).toHaveValue('QA Viaje');
    fireEvent.click(completed);
    expect(active).toHaveAttribute('aria-expanded', 'false');
    expect(completed).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByPlaceholderText('Buscar por número o transportista...')).toBeNull();
  });

  it('labels one matching trip as filtered even when the search field is collapsed', () => {
    const trip: EnTransitoItem = { manifiestoId: 'qa-trip', numero: 'QA Viaje', transportista: 'QA Transporte', origen: 'QA Origen', destino: 'QA Destino', origenLatLng: null, destinoLatLng: null, ultimaPosicion: null, ruta: [] };
    render(<MemoryRouter><Panel trips={[trip]} initialFilter="QA" /></MemoryRouter>);
    const active = screen.getByRole('button', { name: /^Viajes Activos/ });
    expect(active).toHaveTextContent('1 filtrado');
    expect(active).not.toHaveTextContent('1 filtrados');
    fireEvent.click(active);
    expect(active).toHaveAttribute('aria-expanded', 'false');
    expect(active).toHaveTextContent('1 filtrado');
    expect(screen.queryByPlaceholderText('Buscar por número o transportista...')).toBeNull();
  });
});
