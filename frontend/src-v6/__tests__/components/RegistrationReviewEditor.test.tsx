import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationReviewEditor } from '../../components/registration/RegistrationReviewEditor';
const mock = vi.hoisted(() => ({ save: vi.fn(), warning: vi.fn(), owner: 'admin' }));
vi.mock('../../hooks/useAdmissionContext', () => ({ useAdmissionContext: () => ({ owner: mock.owner }) }));
vi.mock('../../services/solicitud.service', () => ({ solicitudService: { corregirDatos: mock.save } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { warning: mock.warning } }));
const application = { id: 'qa-request', tipoActor: 'TRANSPORTISTA', updatedAt: '2026-10-10T10:00:00.000Z', datosActor: JSON.stringify({ razonSocial: 'QA original', domicilio: 'QA dirección original' }) };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mock.owner = 'admin'; });
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
  it('keeps rejected edits visible and rereads for reconciliation without closing or implying approval', async () => {
    const close = vi.fn(), refresh = vi.fn(); mock.save.mockRejectedValue(new Error('QA versión conflictiva'));
    render(<RegistrationReviewEditor application={application as never} onClose={close} onSaved={refresh} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'QA todavía sin guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('QA versión conflictiva'));
    expect(screen.getByLabelText('Domicilio')).toHaveValue('QA todavía sin guardar'); expect(close).not.toHaveBeenCalled(); expect(refresh).toHaveBeenCalledOnce();
  });
  it('does not substitute a malformed saved fleet with an empty form', () => {
    render(<RegistrationReviewEditor application={{ ...application, datosActor: JSON.stringify({ razonSocial: 'QA', choferesJson: '{invalid' }) } as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se reemplazarán');
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeDisabled(); expect(mock.save).not.toHaveBeenCalled();
  });
  it('requires reconciliation with new data, retains only edited fields and uses the new revision after consent', async () => {
    mock.save.mockResolvedValue({}); const close = vi.fn(), refresh = vi.fn();
    const view = render(<RegistrationReviewEditor application={application as never} onClose={close} onSaved={refresh} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'QA edición local anterior' } });
    const newer = { ...application, updatedAt: '2026-10-10T10:01:00.000Z', datosActor: JSON.stringify({ domicilio: 'QA modificación concurrente', razonSocial: 'Nombre actualizado' }) };
    view.rerender(<RegistrationReviewEditor application={newer as never} onClose={close} onSaved={refresh} />);
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('QA modificación concurrente');
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Conservar mis cambios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledWith(application.id, expect.objectContaining({ domicilio: 'QA edición local anterior', razonSocial: 'Nombre actualizado' }), newer.updatedAt));
  });
  it('recovers unsaved edits after reopening and separates administrative identities', () => {
    const props = { application: application as never, onClose: vi.fn(), onSaved: vi.fn() };
    let view = render(<RegistrationReviewEditor {...props} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'Borrador que se conserva' } });
    view.unmount(); mock.owner = 'another';
    view = render(<RegistrationReviewEditor {...props} />);
    expect(screen.getByLabelText('Domicilio')).toHaveValue('QA dirección original');
    view.unmount(); mock.owner = 'admin';
    render(<RegistrationReviewEditor {...props} />);
    expect(screen.getByLabelText('Domicilio')).toHaveValue('Borrador que se conserva');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('retains edits while a fresh read disables writing', () => {
    const props = { application: application as never, onClose: vi.fn(), onSaved: vi.fn() };
    const view = render(<RegistrationReviewEditor {...props} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'Borrador ante consulta lenta' } });
    view.rerender(<RegistrationReviewEditor {...props} readOnly />);
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeDisabled();
    expect(screen.getByLabelText('Domicilio')).toHaveValue('Borrador ante consulta lenta');
    view.rerender(<RegistrationReviewEditor {...props} />);
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeEnabled();
  });
  it('clears confirmed edits before a failed refresh, so they do not reappear as pending', async () => {
    mock.save.mockResolvedValue({});
    const props = { application: application as never, onClose: vi.fn(), onSaved: vi.fn().mockRejectedValue(new Error('offline')) };
    const view = render(<RegistrationReviewEditor {...props} />);
    fireEvent.change(screen.getByLabelText('Domicilio'), { target: { value: 'Escritura confirmada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    view.unmount();
    render(<RegistrationReviewEditor {...props} application={{ ...application, updatedAt: '2026-10-10T10:02:00.000Z', datosActor: '{"domicilio":"Escritura confirmada"}' } as never} />);
    expect(screen.getByLabelText('Domicilio')).toHaveValue('Escritura confirmada');
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeDisabled();
  });

});
