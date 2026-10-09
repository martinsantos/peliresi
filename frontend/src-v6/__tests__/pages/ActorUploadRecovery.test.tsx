import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NuevoGeneradorPage from '../../pages/admin/NuevoGeneradorPage';
import NuevoOperadorPage from '../../pages/admin/NuevoOperadorPage';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), upload: vi.fn(), navigate: vi.fn() }));
vi.mock('../../hooks/useActorRegistrationDraft', () => ({ useActorRegistrationDraft: () => ({ available: null, saved: false, error: null, restoring: false, checkpoint: vi.fn(), clear: vi.fn(), assertSession: vi.fn() }) }));
vi.mock('react-router-dom', async importOriginal => ({
  ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate,
}));
vi.mock('../../hooks/useActores', () => ({
  useGenerador: () => ({ data: undefined, isLoading: false }),
  useOperador: () => ({ data: undefined, isLoading: false }),
  useCreateGenerador: () => ({ mutateAsync: mocks.create, isPending: false }),
  useCreateOperador: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateGenerador: () => ({ mutateAsync: mocks.update, isPending: false }),
  useUpdateOperador: () => ({ mutateAsync: mocks.update, isPending: false }),
}));
vi.mock('../../hooks/useGeneradorFiscal', () => ({
  useUploadDocumento: () => ({ mutateAsync: mocks.upload, isPending: false }),
  useUploadOperadorDocumento: () => ({ mutateAsync: mocks.upload, isPending: false }),
}));
vi.mock('../../hooks/useEnrichment', () => ({
  useGeneradoresEnrichment: () => ({ data: undefined }),
  useOperadoresEnrichment: () => ({ data: undefined }),
}));
vi.mock('../../components/CalculadoraTEF', () => ({ default: () => null }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), add: vi.fn() } }));

for (const actor of [
  { name: 'generador', Page: NuevoGeneradorPage, regulatory: 5, last: 6, idKey: 'generadorId', path: '/admin/actores/generadores' },
  { name: 'operador', Page: NuevoOperadorPage, regulatory: 6, last: 7, idKey: 'operadorId', path: '/admin/actores/operadores' },
]) describe(`${actor.name}: recover partial upload without duplicating registration`, () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue({ id: 'created-actor' });
    mocks.upload.mockResolvedValue({ id: 'document' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  function prepare(files = false) {
    render(<MemoryRouter><actor.Page /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Razon Social *'), { target: { value: 'QA actor synthetic' } });
    fireEvent.change(screen.getByLabelText('CUIT *'), { target: { value: '30-71123596-1' } });
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'upload-qa@night-qa.invalid' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Paso del registro' }), { target: { value: actor.regulatory } });
    fireEvent.change(screen.getByLabelText('Password Inicial *'), { target: { value: 'OnlyLocal-NightQA-2026!' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Paso del registro' }), { target: { value: actor.last } });
    if (files) {
      const inputs = document.querySelectorAll('input[type="file"]');
      fireEvent.change(inputs[0], { target: { files: [new File(['%PDF'], 'uploaded.pdf', { type: 'application/pdf' })] } });
      fireEvent.change(inputs[1], { target: { files: [new File(['%PDF'], 'retry.pdf', { type: 'application/pdf' })] } });
    }
    return screen.getByRole('button', { name: 'Confirmar Registro' });
  }

  it('keeps failed files and retries only those files for the already-created actor', async () => {
    mocks.upload.mockResolvedValueOnce({ id: 'first-document' })
      .mockRejectedValueOnce(new Error('QA disconnected during second upload'))
      .mockResolvedValueOnce({ id: 'second-document' });
    fireEvent.click(prepare(true));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar adjuntos' })).toBeEnabled());
    expect(mocks.navigate).not.toHaveBeenCalled();
    const uploaded = screen.getByText('uploaded.pdf').closest('tr')!;
    expect(uploaded).toHaveTextContent('Guardado');
    expect(uploaded.querySelector('input[type="file"],button')).toBeNull();
    expect(screen.getByText('retry.pdf')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar adjuntos' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(actor.path));
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls.map(([payload]) => [payload[actor.idKey], payload.file.name]))
      .toEqual([['created-actor', 'uploaded.pdf'], ['created-actor', 'retry.pdf'], ['created-actor', 'retry.pdf']]);
    expect(mocks.navigate).toHaveBeenCalledOnce();
  });

  it('blocks a same-tick second submit even before mutation pending state updates', async () => {
    let finish!: (value: { id: string }) => void;
    mocks.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const button = prepare();
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    const count = mocks.create.mock.calls.length;
    finish({ id: 'created-actor' });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(count).toBe(1);
    expect(mocks.navigate).toHaveBeenCalledOnce();
  });

  it('completes a successful registration without attachments normally', async () => {
    fireEvent.click(prepare());
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(actor.path));
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
