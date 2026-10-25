import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ readLegacyFieldCopies: vi.fn(), recoverLegacyFieldEvidence: vi.fn() }));
vi.mock('../../services/inspectionLegacyRecovery', () => api);
import { InspectionLegacyRecovery } from '../../pages/inspecciones/InspectionLegacyRecovery';
const props = () => ({ userId: 'user', inspectionId: 'case', owner: 'G', destination: 'Inspectora · Generador · QA', disabled: false, verifyAccess: vi.fn().mockResolvedValue(undefined), onReview: vi.fn().mockResolvedValue(undefined), onRecoveredFile: vi.fn().mockResolvedValue(undefined) });
function show(p = props()) { const view = render(<InspectionLegacyRecovery {...p} />); fireEvent.click(screen.getByText('Copias de versiones anteriores')); return { ...view, props: p }; }
describe('legacy recovery with current authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); api.readLegacyFieldCopies.mockResolvedValue({ texts: [{ source: 'journal', raw: '{"observaciones":"old"}' }], files: [] }); api.recoverLegacyFieldEvidence.mockResolvedValue(undefined); URL.createObjectURL = vi.fn(() => 'blob:copy'); URL.revokeObjectURL = vi.fn(); });
  afterEach(cleanup);
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
    api.readLegacyFieldCopies.mockResolvedValue({ texts: [], files: [{ id: 'capture', fileName: 'foto.pdf', file: new Blob(['original']) }] }); const { props: p } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar copias anteriores' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Recuperar archivo aquí' }));
    await waitFor(() => expect(api.recoverLegacyFieldEvidence).toHaveBeenCalledWith('user', 'case', 'G', 'capture'));
    expect(p.verifyAccess).toHaveBeenCalledTimes(2); expect(p.onRecoveredFile).toHaveBeenCalledTimes(1);
  });
});
