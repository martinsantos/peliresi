import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InscripcionWizardPage from '../../pages/public/InscripcionWizardPage';
import { readRegistrationDraft, writeRegistrationDraft } from '../../services/registrationDraft';

const mock = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), requirements: vi.fn(), canWrite: vi.fn(), token: '' }));
vi.mock('../../services/api', () => ({ default: { get: mock.get, put: mock.put, post: mock.post }, getAccessToken: () => mock.token, setTokensDurably: vi.fn() }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { getRequirements: mock.requirements } }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: 'owned', canWrite: mock.canWrite, retry: vi.fn() }) }));
const revision = '2026-10-09T10:00:00.000Z';
function session(owner: string) { return `qa.${btoa(JSON.stringify({ id: owner, restricted: true, registrationDraft: 'draft' }))}.qa`; }
function request(owner = 'owner') { return { data: { data: { solicitud: { id: 'draft', usuarioId: owner, tipoActor: 'GENERADOR', estado: 'BORRADOR', datosActor: '{}', updatedAt: revision,
  usuario: { nombre: 'QA responsable', cuit: '30-70987654-3', email: 'qa@night-qa.invalid' }, documentos: [] } } } }; }
async function open() {
  await act(async () => { render(<MemoryRouter initialEntries={['/inscripcion/generador']}><Routes><Route path="/inscripcion/:tipo" element={<InscripcionWizardPage />} /><Route path="/login" element={<p>Ingreso seguro</p>} /></Routes></MemoryRouter>); });
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mock.token = session('owner'); mock.canWrite.mockReturnValue(true);
  mock.get.mockResolvedValue(request()); mock.requirements.mockResolvedValue({ documentos: [], maxBytes: 10485760 });
  mock.put.mockResolvedValue({ data: { data: { solicitud: { updatedAt: '2026-10-09T10:01:00.000Z' } } } });
  mock.post.mockResolvedValue({ data: {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('a real registration UI protects the current step and account boundary', () => {
  it('allows saving an incomplete draft without submitting or moving the current step', async () => {
    await open(); fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA recién escrito' } });
    await waitFor(() => expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')?.data.form).toMatchObject({ razonSocial: 'QA recién escrito' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mock.put).toHaveBeenCalledOnce());
    expect(mock.put.mock.calls[0][1]).toMatchObject({ datosActor: { razonSocial: 'QA recién escrito' }, expectedUpdatedAt: revision });
    expect(mock.post).not.toHaveBeenCalled(); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA recién escrito');
  });
  it('recovers text typed without ever changing steps after a close/reopen', async () => {
    await open(); fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA sin navegar' } });
    await waitFor(() => expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')?.data.form).toMatchObject({ razonSocial: 'QA sin navegar' }));
    cleanup(); await open(); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA sin navegar');
    expect(mock.put).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toHaveTextContent('pendientes de guardar en SITREP');
  });
  it('retains local changes and never claims server saving after an offline error', async () => {
    mock.put.mockRejectedValue(new Error('QA sin conexión')); await open();
    fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'QA recuperable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se confirmó el guardado en SITREP'));
    expect(screen.getByRole('status')).toHaveTextContent('este dispositivo'); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA recuperable');
  });
  it('does not mark edits made during a pending save as server-saved', async () => {
    let finish!: (value: unknown) => void; mock.put.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await open(); const field = screen.getByPlaceholderText('Empresa S.A.');
    fireEvent.change(field, { target: { value: 'QA versión enviada' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    fireEvent.change(field, { target: { value: 'QA edición posterior' } });
    await act(async () => finish({ data: { data: { solicitud: { updatedAt: '2026-10-09T10:01:00.000Z' } } } }));
    expect(field).toHaveValue('QA edición posterior'); expect(screen.getByRole('status')).toHaveTextContent('pendientes de guardar en SITREP');
    expect(mock.put.mock.calls[0][1].datosActor.razonSocial).toBe('QA versión enviada');
  });
  it('blocks a same-tick double save and a second editor', async () => {
    await open(); const button = screen.getByRole('button', { name: 'Guardar borrador' });
    act(() => { fireEvent.click(button); fireEvent.click(button); }); await waitFor(() => expect(mock.put).toHaveBeenCalledOnce());
    mock.canWrite.mockReturnValue(false); fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('otra pestaña')); expect(mock.put).toHaveBeenCalledOnce();
  });
  it('requires explicit reconciliation instead of replacing a newer server draft', async () => {
    writeRegistrationDraft('owner', 'public:GENERADOR:draft', { form: { razonSocial: 'QA copia local' }, serverRevision: '2026-10-09T09:00:00.000Z', step: 1 });
    await open(); expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar mis cambios locales' }));
    expect(screen.getByPlaceholderText('Empresa S.A.')).toHaveValue('QA copia local'); expect(mock.put).not.toHaveBeenCalled();
  });
  it('never renders a local draft after the server identifies a different owner', async () => {
    writeRegistrationDraft('owner', 'public:GENERADOR:draft', { form: { razonSocial: 'PRIVATE-QA' }, serverRevision: revision });
    mock.get.mockResolvedValue(request('other')); await open();
    expect(screen.queryByDisplayValue('PRIVATE-QA')).toBeNull(); expect(screen.getByRole('button', { name: 'Iniciar sesión y recuperar' })).toBeVisible();
  });
  it('clears displayed private fields on account switching without destroying the original draft', async () => {
    await open(); fireEvent.change(screen.getByPlaceholderText('Empresa S.A.'), { target: { value: 'PRIVATE-QA' } });
    await waitFor(() => expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')).not.toBeNull());
    mock.token = session('other'); fireEvent(window, new StorageEvent('storage', { key: 'sitrep_access_token' }));
    expect(screen.queryByDisplayValue('PRIVATE-QA')).toBeNull(); expect(mock.put).not.toHaveBeenCalled();
    expect(readRegistrationDraft('owner', 'public:GENERADOR:draft')?.data.form).toMatchObject({ razonSocial: 'PRIVATE-QA' });
  });
});
