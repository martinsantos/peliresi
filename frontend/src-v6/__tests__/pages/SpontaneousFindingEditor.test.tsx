import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ saveSpontaneousFinding: vi.fn(), protectSpontaneousText: vi.fn(), spontaneousPhoto: vi.fn() }));
vi.mock('../../services/inspectionSpontaneousDraft', async (original) => ({ ...await original<typeof import('../../services/inspectionSpontaneousDraft')>(), ...mocks }));
import { SpontaneousFindingEditor } from '../../pages/inspecciones/SpontaneousFindingEditor';
import { newSpontaneousFinding } from '../../services/inspectionSpontaneousDraft';

describe('field capture closing safety', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.saveSpontaneousFinding.mockResolvedValue({}); });
  const setup = () => { const onClose = vi.fn(); render(<SpontaneousFindingEditor initial={newSpontaneousFinding('one')} actors={{ GENERADOR: [], OPERADOR: [], TRANSPORTISTA: [] }} onClose={onClose} />); return onClose; };

  it('protects typing immediately and waits for storage acknowledgement before closing', async () => {
    let acknowledge!: () => void;
    mocks.saveSpontaneousFinding.mockImplementation(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
    const onClose = setup();
    fireEvent.change(screen.getByLabelText('Descripción del hallazgo'), { target: { value: 'Derrame al costado del acceso' } });
    expect(mocks.protectSpontaneousText).toHaveBeenCalledWith(expect.objectContaining({ description: 'Derrame al costado del acceso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() => expect(mocks.saveSpontaneousFinding).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    acknowledge();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps the capture visible on quota failure and does not claim protection', async () => {
    mocks.saveSpontaneousFinding.mockRejectedValue(new Error('Sin espacio para guardar'));
    const onClose = setup();
    fireEvent.change(screen.getByLabelText('Descripción del hallazgo'), { target: { value: 'Trabajo que debe conservarse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sin espacio'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Descripción del hallazgo')).toHaveValue('Trabajo que debe conservarse');
  });

  it('protects later typing before completing a slow exit', async () => {
    let acknowledge!: () => void;
    mocks.saveSpontaneousFinding.mockImplementationOnce(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
    const onClose = setup();
    fireEvent.change(screen.getByLabelText('Descripción del hallazgo'), { target: { value: 'Primer dato' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() => expect(mocks.saveSpontaneousFinding).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Descripción del hallazgo'), { target: { value: 'Último dato antes de salir' } });
    acknowledge();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.saveSpontaneousFinding).toHaveBeenLastCalledWith(expect.objectContaining({ description: 'Último dato antes de salir' }));
  });
});
