import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TripActionBar } from '../../../components/mobile/TripActionBar';
import { EstadoManifiesto } from '../../../types/models';

describe('TripActionBar', () => {
  it('renders pickup as the primary action for approved trips', () => {
    const onConfirmPickup = vi.fn();

    render(
      <TripActionBar
        estado={EstadoManifiesto.APROBADO}
        viajeStatus="ACTIVO"
        isPending={false}
        hasPendingSync={false}
        onConfirmPickup={onConfirmPickup}
        onTogglePause={vi.fn()}
        onReportIncident={vi.fn()}
        onConfirmDelivery={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar retiro/i }));
    expect(onConfirmPickup).toHaveBeenCalledTimes(1);
  });

  it('renders pause, incident, and delivery actions for active trips', () => {
    render(
      <TripActionBar
        estado={EstadoManifiesto.EN_TRANSITO}
        viajeStatus="ACTIVO"
        isPending={false}
        hasPendingSync
        onConfirmPickup={vi.fn()}
        onTogglePause={vi.fn()}
        onReportIncident={vi.fn()}
        onConfirmDelivery={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Pausar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Incidente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar entrega/i })).toBeInTheDocument();
    expect(screen.getByText('Sync pendiente')).toBeInTheDocument();
  });

  it('allows only delivery when a verified saved trip has no connection', () => {
    render(<TripActionBar estado={EstadoManifiesto.EN_TRANSITO} viajeStatus="ACTIVO" isPending={false} hasPendingSync={false}
      connectionLimited onConfirmPickup={vi.fn()} onTogglePause={vi.fn()} onReportIncident={vi.fn()} onConfirmDelivery={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Pausar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Incidente/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirmar entrega/i })).toBeEnabled();
  });

  it('blocks delivery if the handoff status is not known', () => {
    render(<TripActionBar estado={EstadoManifiesto.EN_TRANSITO} viajeStatus="ACTIVO" isPending={false} hasPendingSync={false}
      disabled onConfirmPickup={vi.fn()} onTogglePause={vi.fn()} onReportIncident={vi.fn()} onConfirmDelivery={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Confirmar entrega/i })).toBeDisabled();
  });
});
