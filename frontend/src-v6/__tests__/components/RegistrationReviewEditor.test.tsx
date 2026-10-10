import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationReviewEditor } from '../../components/registration/RegistrationReviewEditor';
const mock = vi.hoisted(() => ({ save: vi.fn(), warning: vi.fn() }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { corregirDatos: mock.save } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { warning: mock.warning } }));
const application = { id: 'qa-request', tipoActor: 'TRANSPORTISTA', updatedAt: '2026-10-10T10:00:00.000Z', datosActor: JSON.stringify({ razonSocial: 'QA original', domicilio: 'QA dirección original' }) };
beforeEach(() => vi.clearAllMocks());
describe('administrative declaration correction acknowledgement', () => {
  it('sends the edited declaration with its original revision and never confuses a failed refresh with a failed write', async () => {
    const close = vi.fn(), refresh = vi.fn().mockRejectedValue(new Error('QA refresh failed'));
    mock.save.mockResolvedValue({});
    render(<RegistrationReviewEditor application={application as never} onClose={close} onSaved={refresh} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'QA dirección corregida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(mock.save).toHaveBeenCalledWith('qa-request', expect.objectContaining({ domicilio: 'QA dirección corregida' }), application.updatedAt);
    await waitFor(() => expect(mock.warning).toHaveBeenCalledWith('Corrección guardada', expect.any(String)));
    expect(mock.save).toHaveBeenCalledOnce(); expect(screen.queryByText(/No se confirmó la corrección/)).not.toBeInTheDocument();
  });
  it('keeps rejected edits visible without refreshing, closing or implying approval', async () => {
    const close = vi.fn(), refresh = vi.fn(); mock.save.mockRejectedValue(new Error('QA versión conflictiva'));
    render(<RegistrationReviewEditor application={application as never} onClose={close} onSaved={refresh} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'QA todavía sin guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('QA versión conflictiva'));
    expect(screen.getByLabelText('Domicilio')).toHaveValue('QA todavía sin guardar'); expect(close).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
  it('does not substitute a malformed saved fleet with an empty form', () => {
    render(<RegistrationReviewEditor application={{ ...application, datosActor: JSON.stringify({ razonSocial: 'QA', choferesJson: '{invalid' }) } as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se reemplazarán');
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeDisabled(); expect(mock.save).not.toHaveBeenCalled();
  });
});
