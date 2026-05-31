import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperatorActionQueue } from '../../../components/mobile/OperatorActionQueue';
import { EstadoManifiesto } from '../../../types/models';

const item = {
  id: 'm1',
  numero: 'M-300',
  estado: EstadoManifiesto.ENTREGADO,
  generador: { razonSocial: 'Generador Sur' },
  transportista: { razonSocial: 'Transporte Uno' },
};

describe('OperatorActionQueue', () => {
  it('renders receipt action for delivered manifests', () => {
    const onOpen = vi.fn();

    render(<OperatorActionQueue manifiestos={[item]} onOpenManifiesto={onOpen} />);

    expect(screen.getByText('Recepcion pendiente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir manifiesto M-300/i }));
    expect(onOpen).toHaveBeenCalledWith('m1');
  });

  it('renders empty state', () => {
    render(<OperatorActionQueue manifiestos={[]} onOpenManifiesto={vi.fn()} />);

    expect(screen.getByText('Sin acciones de operador')).toBeInTheDocument();
  });
});
