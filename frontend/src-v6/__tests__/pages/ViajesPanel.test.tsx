import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ViajesPanel } from '../../pages/centro-control/components/ViajesPanel';

function Panel() {
  const [panel, setPanel] = useState<'activos' | 'realizados' | 'inspecciones' | null>('activos');
  const [filter, setFilter] = useState('');
  return <ViajesPanel inspections={[]} filteredEnTransito={[]} viajesRealizados={[]} tripFilter={filter} onTripFilterChange={setFilter} tripPanel={panel} onTripPanelChange={setPanel} selectedTripId={null} onSelectTrip={vi.fn()} selectedRealizadoId={null} onSelectRealizado={vi.fn()} viajesRef={{ current: null }} />;
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
    fireEvent.click(active);
    fireEvent.click(active);
    expect(screen.getByPlaceholderText('Buscar por número o transportista...')).toHaveValue('QA Viaje');
    fireEvent.click(completed);
    expect(active).toHaveAttribute('aria-expanded', 'false');
    expect(completed).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByPlaceholderText('Buscar por número o transportista...')).toBeNull();
  });
});
