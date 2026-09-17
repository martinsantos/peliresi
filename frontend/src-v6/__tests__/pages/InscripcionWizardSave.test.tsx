import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';
import api from '../../services/api';

vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useParams: () => ({ tipo: 'transportista' }) }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

describe('Inscripcion safe navigation and recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear();
    localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: 'draft-qa', tipoActor: 'TRANSPORTISTA' }));
    vi.mocked(api.get).mockResolvedValue({ data: { data: { solicitud: { tipoActor: 'TRANSPORTISTA', estado: 'BORRADOR', datosActor: JSON.stringify({ razonSocial: 'QA empresa', domicilio: 'QA domicilio' }), documentos: [] } } } });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
  });
  afterEach(cleanup);
  const mount = () => render(<MemoryRouter><InscripcionWizardPage /></MemoryRouter>);

  it('stays on the same step after failed save, preserves fields and retries', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('offline'));
    mount(); await screen.findByDisplayValue('QA empresa');
    fireEvent.change(screen.getByDisplayValue('QA empresa'), { target: { value: 'QA corregida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar');
    expect(screen.getByText('Paso 1 de 5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('QA corregida')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Paso 2 de 5');
    expect(api.put).toHaveBeenLastCalledWith('/solicitudes/draft-qa/secciones/empresa', { data: expect.objectContaining({ razonSocial: 'QA corregida' }) });
  });

  it('saves before a stepper jump and prevents duplicate navigation while pending', async () => {
    let finish!: () => void;
    vi.mocked(api.put).mockReturnValueOnce(new Promise(resolve => { finish = () => resolve({ data: {} }); }));
    mount(); await screen.findByDisplayValue('QA empresa');
    const next = screen.getByRole('button', { name: /Paso 3 de 5: Vehículos/ });
    fireEvent.click(next); fireEvent.click(next);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Paso 1 de 5')).toBeInTheDocument();
    finish(); await screen.findByText('Paso 3 de 5');
  });

  it('keeps the recovery pointer on a connection failure and can retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se borró tu solicitud');
    expect(localStorage.getItem('sitrep_pending_solicitud')).toContain('draft-qa');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar recuperación' }));
    await screen.findByDisplayValue('QA empresa');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled());
  });
});
