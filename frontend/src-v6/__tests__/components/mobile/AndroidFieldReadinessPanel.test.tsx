import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AndroidFieldReadinessPanel } from '../../../components/mobile/AndroidFieldReadinessPanel';

describe('AndroidFieldReadinessPanel', () => {
  it('shows ready status when connection, queue and app mode are healthy', () => {
    render(
      <AndroidFieldReadinessPanel
        role="TRANSPORTISTA"
        isOnline
        isApiReachable
        activeCount={1}
        pendingCount={0}
        isStandalone
      />,
    );

    expect(screen.getByText('Score operativo Android')).toBeInTheDocument();
    expect(screen.getByText('3/3 listo')).toBeInTheDocument();
    expect(screen.getByText('Viaje activo disponible')).toBeInTheDocument();
  });

  it('shows degraded status when offline and without assigned work', () => {
    render(
      <AndroidFieldReadinessPanel
        role="OPERADOR"
        isOnline={false}
        isApiReachable={false}
        activeCount={0}
        pendingCount={0}
        isStandalone={false}
      />,
    );

    expect(screen.getByText('1/3 listo')).toBeInTheDocument();
    expect(screen.getByText('Sin conexion operativa')).toBeInTheDocument();
    expect(screen.getByText('Sin acciones pendientes')).toBeInTheDocument();
    expect(screen.getByText('Abrir como app instalada')).toBeInTheDocument();
  });
});
