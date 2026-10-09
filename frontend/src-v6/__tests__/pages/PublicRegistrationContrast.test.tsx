import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StepCuenta } from '../../pages/public/inscripcion/steps/StepCuenta';

const requests = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: requests }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() }, getAccessToken: () => null, setTokensDurably: vi.fn() }));

describe('Public account forms have a readable, working return to login', () => {
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as const)('%s shares the accessible login action without creating an account', tipoActor => {
    render(<MemoryRouter initialEntries={['/inscripcion']}><Routes>
      <Route path="/inscripcion" element={<StepCuenta tipoActor={tipoActor}
        isGenerador={tipoActor === 'GENERADOR'} isOperador={tipoActor === 'OPERADOR'} isTransportista={tipoActor === 'TRANSPORTISTA'}
        reg={{ nombre: '', email: '', cuit: '', password: '', confirmPassword: '' }} onRegChange={vi.fn()} onPhase2={vi.fn()} />} />
      <Route path="/login" element={<h1>Ingreso institucional</h1>} />
    </Routes></MemoryRouter>);
    const action = screen.getByRole('button', { name: 'Iniciá sesión para recuperar tus datos' });
    expect(action).toHaveClass('text-primary-800', 'hover:underline', 'focus-visible:ring-2', 'min-h-11');
    fireEvent.click(action);
    expect(screen.getByRole('heading', { name: 'Ingreso institucional' })).toBeVisible();
    expect(requests.post).not.toHaveBeenCalled();
  });
});
