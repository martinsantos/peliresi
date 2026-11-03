import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ readLegacyFieldCopies: vi.fn(), recoverLegacyFieldEvidence: vi.fn() }));
vi.mock('../../services/inspectionLegacyRecovery', () => api);
import { InspectionLegacyRecovery } from '../../pages/inspecciones/InspectionLegacyRecovery';
const props = () => ({ userId: 'user', inspectionId: 'case', owner: 'G', destination: 'Inspectora · Generador · QA', disabled: false, verifyAccess: vi.fn().mockResolvedValue(undefined), onReview: vi.fn().mockResolvedValue(undefined), onRecoveredFile: vi.fn().mockResolvedValue(undefined) });
function show(p = props()) { const view = render(<InspectionLegacyRecovery {...p} />); fireEvent.click(screen.getByText('Copias de versiones anteriores')); return { ...view, props: p }; }
describe('legacy recovery with current authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); api.readLegacyFieldCopies.mockResolvedValue({ texts: [{ source: 'journal', raw: '{"observaciones":"old"}' }], files: [] }); api.recoverLegacyFieldEvidence.mockResolvedValue(undefined); URL.createObjectURL = vi.fn(() => 'blob:copy'); URL.revokeObjectURL = vi.fn(); });
  afterEach(cleanup);
  it('explains that current autosaved work is separate from legacy recovery', () => {
    show();
    expect(screen.getByText('Este panel no muestra el borrador actual.')).toBeVisible();
    expect(screen.getByText(/Lo que escribís ahora se guarda automáticamente por separado/)).toBeVisible();
    expect(api.readLegacyFieldCopies).not.toHaveBeenCalled();
  });
  it('shows permission/search progress and a completed result instead of a silent click', async () => {
    let finish!: (value: { texts: unknown[]; files: unknown[] }) => void;
    api.readLegacyFieldCopies.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando permiso para buscar copias anteriores');
    expect(screen.getByRole('button', { name: 'Buscar copias anteriores' })).toBeDisabled();
    await waitFor(() => expect(api.readLegacyFieldCopies).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('Buscando copias anteriores en este dispositivo');
    await act(async () => finish({ texts: [], files: [] }));
    expect(screen.getByRole('status')).toHaveTextContent('Búsqueda 1 finalizada');
    expect(screen.getByRole('status')).toHaveTextContent('El borrador actual se consulta por separado');
    expect(screen.getByRole('button', { name: 'Buscar copias anteriores' })).toBeEnabled();
  });
  it('confirms every empty repeat search without claiming the current draft was lost', async () => {
    api.readLegacyFieldCopies.mockResolvedValue({ texts: [], files: [] }); show();
    const button = screen.getByRole('button', { name: 'Buscar copias anteriores' });
    fireEvent.click(button);
    await screen.findByText(/Búsqueda 1 finalizada/);
    fireEvent.click(button);
    expect(await screen.findByText(/Búsqueda 2 finalizada/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('no indica que se haya perdido');
  });
  it('reports unavailable storage as failure and allows an explicit retry, never an empty success', async () => {
    api.readLegacyFieldCopies.mockRejectedValueOnce(new Error('No se pudo leer el almacenamiento local'));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el almacenamiento local');
    expect(screen.queryByText(/Búsqueda 1 finalizada/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Descargar original' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    expect(await screen.findByText(/Búsqueda 1 finalizada/)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('clears previous results and invalidates an in-flight read when the destination owner changes', async () => {
    const p = props(); const view = show(p);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    await screen.findByRole('button', { name: 'Revisar texto guardado' });
    let finish!: (value: unknown) => void;
    api.readLegacyFieldCopies.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    await waitFor(() => expect(api.readLegacyFieldCopies).toHaveBeenCalledTimes(2));
    view.rerender(<InspectionLegacyRecovery {...p} owner="O" destination="Operador · Otro destino" />);
    fireEvent.click(screen.getByText('Copias de versiones anteriores'));
    await act(async () => finish({ texts: [{ source: 'journal', raw: '{"observaciones":"old owner"}' }], files: [] }));
    expect(screen.queryByRole('button', { name: 'Revisar texto guardado' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Descargar original' })).toBeNull();
    expect(p.onReview).not.toHaveBeenCalled();
    expect(api.recoverLegacyFieldEvidence).not.toHaveBeenCalled();
  });
  it('does not run the previous permission callback after switching accounts in place', async () => {
    const p = props(); let authorize!: () => void;
    p.verifyAccess.mockImplementationOnce(() => new Promise<void>(resolve => { authorize = resolve; }));
    const view = show(p); fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    view.rerender(<InspectionLegacyRecovery {...p} userId="other-user" />);
    await act(async () => authorize());
    expect(api.readLegacyFieldCopies).not.toHaveBeenCalled();
    expect(p.onReview).not.toHaveBeenCalled();
  });
  it('keeps recovery disabled when the current activity is not editable', () => {
    show({ ...props(), disabled: true });
    const button = screen.getByRole('button', { name: 'Buscar copias anteriores' });
    expect(button).toBeDisabled();fireEvent.click(button);
    expect(screen.getByText(/La búsqueda y la recuperación requieren conexión y permiso/)).toBeVisible();
    expect(api.readLegacyFieldCopies).not.toHaveBeenCalled();
  });
  it('requires an explicit search and fresh permission before reading a local copy', async () => {
    const { props: p } = show(); expect(api.readLegacyFieldCopies).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    expect(await screen.findByRole('button', { name: 'Revisar texto guardado' })).toBeEnabled();
    expect(p.verifyAccess).toHaveBeenCalledTimes(1); expect(p.onReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar texto guardado' }));
    await waitFor(() => expect(p.onReview).toHaveBeenCalledWith('{"observaciones":"old"}'));
    expect(p.verifyAccess).toHaveBeenCalledTimes(2);
  });
  it('does not expose old data when authorization fails', async () => {
    const p = props(); p.verifyAccess.mockRejectedValue(new Error('Acceso no autorizado')); show(p);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso no autorizado');
    expect(api.readLegacyFieldCopies).not.toHaveBeenCalled();
  });
  it('ignores an authorized result arriving after a context unmount', async () => {
    const p = props(); let done!: () => void; p.verifyAccess.mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    const view = show(p); fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' })); view.unmount(); done();
    await Promise.resolve(); expect(api.readLegacyFieldCopies).not.toHaveBeenCalled();
  });
  it('revokes local review when access is lost after the search', async () => {
    const p = props(); show(p);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    await screen.findByRole('button', { name: 'Revisar texto guardado' });
    p.verifyAccess.mockRejectedValue(new Error('Acceso revocado'));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar texto guardado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso revocado');
    expect(p.onReview).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Descargar original' })).not.toBeInTheDocument();
  });
  it('offers download, never import, for malformed text', async () => {
    api.readLegacyFieldCopies.mockResolvedValue({ texts: [{ source: 'journal', raw: '{unfinished' }], files: [] }); show();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    expect(await screen.findByRole('button', { name: 'Revisar texto guardado' })).toBeDisabled();
    expect(await screen.findByRole('link', { name: 'Descargar original' })).toHaveAttribute('download');
  });
  it('claims explicitly and refreshes the queue without sending a file', async () => {
    api.readLegacyFieldCopies.mockResolvedValueOnce({ texts: [], files: [{ id: 'capture', fileName: 'foto.pdf', file: new Blob(['original']) }] }).mockResolvedValueOnce({ texts: [], files: [] }); const { props: p } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Recuperar archivo aquí' }));
    await waitFor(() => expect(api.recoverLegacyFieldEvidence).toHaveBeenCalledWith('user', 'case', 'G', 'capture'));
    expect(p.verifyAccess).toHaveBeenCalledTimes(2); expect(p.onRecoveredFile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Archivo recuperado en Evidencias/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Recuperar archivo aquí' })).toBeNull();
  });
});
