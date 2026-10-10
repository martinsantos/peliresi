import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';
import { readTrialDraft } from '../../services/registrationTrial';
const requests = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), requirements: vi.fn() }));
vi.mock('../../services/api', () => ({ default: requests, getAccessToken: () => null }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { getRequirements: requests.requirements } }));
async function open(type: string) { await act(async () => { render(<MemoryRouter initialEntries={[`/inscripcion/${type}?modo=revision`]}><Routes><Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} /></Routes></MemoryRouter>); }); }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); requests.requirements.mockResolvedValue({ documentos: [], maxBytes: 10 * 1024 * 1024 }); vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('trial recovery is visible and isolated from real registration', () => {
  it.each([['generador', 7, 'Regulatorio'], ['operador', 8, 'Regulatorio'], ['transportista', 5, 'Habilitacion']] as const)('%s restores values and step without any business write', async (type, total, second) => {
    await open(type); fireEvent.change(screen.getByLabelText('Razon Social *'), { target: { value: 'QA borrador recuperado' } });
    fireEvent.click(screen.getByRole('button', { name: `Paso 2 de ${total}: ${second}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador de prueba' }));
    expect(readTrialDraft(type.toUpperCase())?.data.step).toBe(2);
    cleanup(); await open(type);
    expect(screen.getByRole('button', { name: `Paso 2 de ${total}: ${second}` })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Paso 1 de ${total}:`) }));
    expect(screen.getByLabelText('Razon Social *')).toHaveValue('QA borrador recuperado');
    expect(requests.get).not.toHaveBeenCalled(); expect(requests.post).not.toHaveBeenCalled(); expect(requests.put).not.toHaveBeenCalled();
  });
  it('shows a write failure without claiming a local save or dropping the visible fields', async () => {
    await open('generador'); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QA full storage'); });
    fireEvent.change(screen.getByLabelText('Razon Social *'), { target: { value: 'QA dato no perdido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador de prueba' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se guardó la prueba'));
    expect(screen.getByLabelText('Razon Social *')).toHaveValue('QA dato no perdido'); expect(screen.getByRole('status')).toHaveTextContent('no se confirmó');
  });
});
