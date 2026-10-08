import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';

const requests = vi.hoisted(() => ({ getRequirements: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { put: requests.put, post: requests.post } }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { getRequirements: requests.getRequirements } }));

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
const railScroll = vi.fn();

describe('Shared registration navigation keeps identity, steps and data stable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests.getRequirements.mockResolvedValue({ documentos: [], maxBytes: 10 * 1024 * 1024 });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: railScroll });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
    else delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it.each([
    ['generador', 'Generador', 7, 'Regulatorio'],
    ['operador', 'Operador', 8, 'Regulatorio'],
    ['transportista', 'Transportista', 5, 'Habilitacion'],
  ] as const)('%s does not indent its title or move the viewport while typing', async (type, label, total, secondStep) => {
    await act(async () => {
      render(<MemoryRouter initialEntries={[`/inscripcion/${type}?modo=revision`]}><Routes>
        <Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} />
      </Routes></MemoryRouter>);
    });
    const identity = screen.getByTestId('registration-identity');
    expect(identity.firstElementChild).toBe(screen.getByRole('heading', { name: `Inscripción como ${label}`, exact: true }));
    expect(within(identity).getByRole('button', { name: 'Volver a la pantalla anterior' })).toHaveTextContent('Volver');
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(railScroll).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'center', behavior: 'instant' });
    const rail = screen.getByRole('navigation', { name: 'Etapas de la inscripción' });
    expect(within(rail).getAllByRole('button')).toHaveLength(total);
    for (const button of within(rail).getAllByRole('button')) expect(button.querySelector('span')).not.toHaveClass('hidden');
    vi.mocked(window.scrollTo).mockClear();
    railScroll.mockClear();
    const company = screen.getByPlaceholderText(type === 'transportista' ? 'Transporte S.A.' : type === 'operador' ? 'Operador S.A.' : 'Empresa S.A.');
    fireEvent.change(company, { target: { value: 'QA dato conservado al cambiar de paso' } });
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(railScroll).not.toHaveBeenCalled();
    fireEvent.click(within(rail).getByRole('button', { name: `Paso 2 de ${total}: ${secondStep}`, exact: true }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' });
    const active = within(rail).getByRole('button', { name: `Paso 2 de ${total}: ${secondStep}`, exact: true });
    expect(active).toHaveAttribute('aria-current', 'step');
    expect(active.firstElementChild).toHaveTextContent('2');
    expect(active.firstElementChild).toHaveClass('bg-primary-700', 'text-white');
    fireEvent.click(screen.getByRole('button', { name: 'Anterior', exact: true }));
    expect(screen.getByPlaceholderText(type === 'transportista' ? 'Transporte S.A.' : type === 'operador' ? 'Operador S.A.' : 'Empresa S.A.')).toHaveValue('QA dato conservado al cambiar de paso');
    expect(requests.put).not.toHaveBeenCalled();
    expect(requests.post).not.toHaveBeenCalled();
  });
});
