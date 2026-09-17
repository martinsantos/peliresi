import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InscripcionWizardPage review mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('opens the prefilled international generator wizard without creating an account', () => {
    renderRoute('/inscripcion/generador?modo=revision');

    expect(screen.getByText(/Modo revisión de alta/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Crear cuenta y continuar/i })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Generador QA Internacional S.A.')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('allows advancing without required fields in review mode', async () => {
    renderRoute('/inscripcion/generador?modo=revision');

    const businessName = screen.getByDisplayValue('Generador QA Internacional S.A.');
    await userEvent.clear(businessName);
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByRole('button', { name: /Paso 2 de 7: Regulatorio/i })).toHaveAttribute('aria-current', 'step');
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows transport vehicles, drivers and local-only license OCR controls', async () => {
    renderRoute('/inscripcion/transportista?modo=revision');

    await userEvent.click(screen.getByRole('button', { name: /Paso 3 de 5: Vehículos/i }));
    expect(screen.getByDisplayValue('QA123AB')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LIC-QA-001')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Paso 4 de 5: Documentos/i }));
    expect(screen.getByRole('button', { name: /Probar OCR de licencia/i })).toBeInTheDocument();
    expect(screen.getByText('Licencia de conducir — soporte de choferes')).toBeInTheDocument();
    expect(screen.getAllByText('Frente').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dorso').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Paso 5 de 5: Resumen/i }));
    await userEvent.click(screen.getByRole('button', { name: /Finalizar revisión/i }));
    expect(screen.getByRole('heading', { name: 'Revisión finalizada' })).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('opens the prefilled operator wizard without mutating data', async () => {
    renderRoute('/inscripcion/operador?modo=revision');

    expect(screen.getByText(/Modo revisión de alta/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Operador QA Tratamiento Exterior S.A.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Paso 8 de 8: Resumen/i }));
    await userEvent.click(screen.getByRole('button', { name: /Finalizar revisión/i }));
    expect(screen.getByRole('heading', { name: 'Revisión finalizada' })).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
