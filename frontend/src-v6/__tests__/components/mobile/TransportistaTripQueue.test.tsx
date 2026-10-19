import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransportistaTripQueue } from '../../../components/mobile/TransportistaTripQueue';

const activeTrip = { id: 'trip-active', numero: 'M-001', operador: { razonSocial: 'Planta Sur' }, generador: { razonSocial: 'Generador Norte' } };
const pendingTrip = { id: 'trip-pending', numero: 'M-002', operador: { razonSocial: 'Planta Norte' }, generador: { razonSocial: 'Generador Centro' } };

describe('TransportistaTripQueue', () => {
  it('routes to active trip first', () => {
    const onOpenTrip = vi.fn();

    render(<TransportistaTripQueue activeTrips={[activeTrip]} pendingTrips={[pendingTrip]} onOpenTrip={onOpenTrip} />);

    fireEvent.click(screen.getByRole('button', { name: /Ir al viaje M-001/i }));
    expect(onOpenTrip).toHaveBeenCalledWith('trip-active');
  });

  it('shows empty state when there are no trips', () => {
    render(<TransportistaTripQueue activeTrips={[]} pendingTrips={[]} onOpenTrip={vi.fn()} />);

    expect(screen.getByText('Sin viajes asignados')).toBeInTheDocument();
  });

  it('keeps concurrent trips and pending pickups separately selectable', () => {
    const onOpenTrip = vi.fn();
    render(<TransportistaTripQueue activeTrips={[activeTrip, { ...activeTrip, id: 'trip-second', numero: 'M-003' }]} pendingTrips={[pendingTrip]} onOpenTrip={onOpenTrip} activeTotal={2} pendingTotal={1} />);
    expect(screen.getByRole('heading', { name: 'En tránsito: 2 manifiestos' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Listos para retirar: 1 manifiesto' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ir al viaje M-003' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir viaje asignado M-002' }));
    expect(onOpenTrip).toHaveBeenNthCalledWith(1, 'trip-second');
    expect(onOpenTrip).toHaveBeenNthCalledWith(2, 'trip-pending');
    expect(screen.getByText(/Cada móvil transmite GPS únicamente/)).toBeVisible();
  });
});
