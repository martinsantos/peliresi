import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StepCuenta } from '../../pages/public/inscripcion/steps/StepCuenta';

const emptyRegistration = {
  nombre: '',
  email: '',
  password: '',
  confirmPassword: '',
  cuit: '',
};

describe('StepCuenta', () => {
  it('exposes every registration control through an accessible label', () => {
    render(
      <MemoryRouter>
        <StepCuenta
          tipoActor="GENERADOR"
          isGenerador
          isOperador={false}
          isTransportista={false}
          reg={emptyRegistration}
          onRegChange={vi.fn()}
          onPhase2={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Nombre completo *')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Correo electrónico *')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('CUIT *')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('Contraseña *')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Confirmar contraseña *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
  });

  it('announces validation errors without submitting an incomplete account', async () => {
    const onPhase2 = vi.fn();
    render(
      <MemoryRouter>
        <StepCuenta
          tipoActor="GENERADOR"
          isGenerador
          isOperador={false}
          isTransportista={false}
          reg={emptyRegistration}
          onRegChange={vi.fn()}
          onPhase2={onPhase2}
        />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Crear cuenta y continuar/i }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(screen.getByLabelText('Correo electrónico *')).toHaveAttribute('aria-invalid', 'true');
    expect(onPhase2).not.toHaveBeenCalled();
  });
});
