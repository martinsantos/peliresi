import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileRoleHero } from '../../../components/mobile/MobileRoleHero';

describe('MobileRoleHero', () => {
  it('prioritizes transportista field work', () => {
    render(<MobileRoleHero role="TRANSPORTISTA" userName="Transporte Andes" activeCount={1} pendingCount={2} />);

    expect(screen.getByText('Modo transporte')).toBeInTheDocument();
    expect(screen.getByText(/1 viaje activo/i)).toBeInTheDocument();
    expect(screen.getByText(/2 asignados/i)).toBeInTheDocument();
  });

  it('uses role-neutral counters outside transportista mode', () => {
    render(<MobileRoleHero role="OPERADOR" userName="Operador con un nombre institucional largo" activeCount={0} pendingCount={3} />);

    expect(screen.getByText('Modo operador')).toBeInTheDocument();
    expect(screen.getByText('0 activos')).toBeInTheDocument();
    expect(screen.getByText('3 pendientes')).toBeInTheDocument();
    expect(screen.queryByText(/viaje activo/i)).not.toBeInTheDocument();
  });
});
