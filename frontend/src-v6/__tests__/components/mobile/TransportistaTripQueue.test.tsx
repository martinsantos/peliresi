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
});
