import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisteredAccount } from '../../pages/public/inscripcion/RegisteredAccount';
import SolicitarCambiosPage from '../../pages/perfil/SolicitarCambiosPage';
const mock = vi.hoisted(() => ({ get: vi.fn(), token: '', role: 'GENERADOR', submit: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: mock.get }, getAccessToken: () => mock.token }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'owner', actorId: 'actor' }, isGenerador: mock.role === 'GENERADOR', isOperador: mock.role === 'OPERADOR' }) }));
vi.mock('../../services/renovacion.service', () => ({ renovacionService: { create: mock.submit } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); mock.role = 'GENERADOR'; mock.token = `qa.${btoa(JSON.stringify({ id: 'owner' }))}.qa`; });
describe('existing registry is available only through the verified owner and actual API shape', () => {
  it.each(['GENERADOR', 'OPERADOR'] as const)('%s precarga uses the wrapped actor API and retains the current address', async role => {
    mock.role = role; mock.get.mockResolvedValue({ data: { data: { [role.toLowerCase()]: { id: 'actor', razonSocial: 'QA padrón', domicilio: 'QA domicilio anterior', telefono: '0261-QA' } } } });
    await act(async () => render(<MemoryRouter><SolicitarCambiosPage /></MemoryRouter>));
    expect(screen.getByLabelText('Razon Social')).toHaveValue('QA padrón'); expect(screen.getByLabelText('Domicilio')).toHaveValue('QA domicilio anterior');
    expect(mock.submit).not.toHaveBeenCalled();
  });
  it('never renders an editable empty registry after a failed preload', async () => {
    mock.get.mockRejectedValue(new Error('QA offline')); await act(async () => render(<MemoryRouter><SolicitarCambiosPage /></MemoryRouter>));
    expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.getByRole('button', { name: 'Reintentar precarga' })).toBeVisible(); expect(mock.submit).not.toHaveBeenCalled();
  });
  it('does not display another account profile even if its response finishes late', async () => {
    let finish!: (value: unknown) => void; mock.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<MemoryRouter><RegisteredAccount type="GENERADOR"><p>Nueva cuenta</p></RegisteredAccount></MemoryRouter>);
    mock.token = `qa.${btoa(JSON.stringify({ id: 'other' }))}.qa`;
    await act(async () => finish({ data: { data: { user: { id: 'owner', activo: true, rol: 'GENERADOR', generador: { razonSocial: 'PRIVATE-QA', cuit: 'QA', domicilio: 'QA' } } } } }));
    expect(screen.queryByText('PRIVATE-QA')).toBeNull(); expect(screen.getByText('Nueva cuenta')).toBeVisible();
  });
  it('offers the existing review circuit instead of creating a duplicate account', async () => {
    mock.get.mockResolvedValue({ data: { data: { user: { id: 'owner', activo: true, rol: 'GENERADOR', generador: { razonSocial: 'QA padrón', cuit: 'QA', domicilio: 'QA' } } } } });
    await act(async () => render(<MemoryRouter><Routes><Route path="/" element={<RegisteredAccount type="GENERADOR"><p>Nueva cuenta</p></RegisteredAccount>} /><Route path="/mi-perfil/solicitar-cambios" element={<p>Revisión precargada</p>} /></Routes></MemoryRouter>));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar mis datos precargados' }));
    await waitFor(() => expect(screen.getByText('Revisión precargada')).toBeVisible()); expect(mock.submit).not.toHaveBeenCalled();
  });
});
