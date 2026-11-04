import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const api = vi.hoisted(() => ({ readLegacyExchangeCopies: vi.fn(), legacyExchangeBlocker: vi.fn() }));
vi.mock('../../services/inspectionLegacyExchange', () => api);
import { InspectionLegacyExchangeRecovery } from '../../pages/inspecciones/InspectionLegacyExchangeRecovery';
const draft = { tipo: 'DESCARGO', asunto: 'Copia anterior', cuerpo: 'Contenido original.', respondeAId: 'request', plazoRespuestaAt: '' };
const copy = () => ({ id: 'checkpoint', raw: JSON.stringify(draft), draft, files: [new File(['original'], 'anterior.pdf', { lastModified: 1 })], savedAt: '', unreadableFiles: false });
const props = () => ({ userId: 'user', inspectionId: 'case', destination: 'Generador · QA', disabled: false, verifyAccess: vi.fn().mockResolvedValue({}), onRecover: vi.fn().mockResolvedValue(true) });
function show(p = props()) { const view = render(<InspectionLegacyExchangeRecovery {...p} />); fireEvent.click(screen.getByText('Copias de respuestas anteriores')); return { ...view, p }; }
async function search() { fireEvent.click(screen.getByRole('button', { name: 'Buscar respuestas guardadas' })); await screen.findByRole('link', { name: 'Descargar texto original' }); }
describe('legacy response review', () => {
  beforeEach(() => { vi.clearAllMocks(); api.readLegacyExchangeCopies.mockResolvedValue([copy()]); api.legacyExchangeBlocker.mockResolvedValue(null); URL.createObjectURL = vi.fn(() => 'blob:original'); URL.revokeObjectURL = vi.fn(); Object.defineProperty(crypto, 'subtle', { configurable: true, value: webcrypto.subtle }); });
  afterEach(cleanup);
  it('reads only after explicit authorized search, and recovery revalidates without sending', async () => {
    const { p } = show(); expect(api.readLegacyExchangeCopies).not.toHaveBeenCalled(); await search();
    expect(p.onRecover).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Recuperar para revisar' }));
    await waitFor(() => expect(p.onRecover).toHaveBeenCalledOnce()); expect(p.verifyAccess).toHaveBeenCalledTimes(2);
  });
  it('does not read old data after access rejection', async () => {
    const p = props(); p.verifyAccess.mockRejectedValue(new Error('Acceso revocado')); show(p);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar respuestas guardadas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso revocado'); expect(api.readLegacyExchangeCopies).not.toHaveBeenCalled();
  });
  it('discards authorization arriving after a context change', async () => {
    const p = props(); let done!: () => void; p.verifyAccess.mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    const view = show(p); fireEvent.click(screen.getByRole('button', { name: 'Buscar respuestas guardadas' })); view.unmount(); done();
    await Promise.resolve(); expect(api.readLegacyExchangeCopies).not.toHaveBeenCalled();
  });
  it('blocks same-size file replacement between review and recovery', async () => {
    const { p } = show(); await search(); const changed = copy(); changed.files = [new File(['replaced'], 'anterior.pdf', { lastModified: 1 })]; api.readLegacyExchangeCopies.mockResolvedValue([changed]);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar para revisar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('cambió en otra pestaña'); expect(p.onRecover).not.toHaveBeenCalled();
  });
  it('removes the previous local review after access is revoked', async () => {
    const { p } = show(); await search(); p.verifyAccess.mockRejectedValue(new Error('Acceso revocado'));
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar para revisar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso revocado'); expect(screen.queryByText('Contenido original.')).toBeNull();
  });
  it('keeps download available for closed, incompatible or already registered copies', async () => {
    api.legacyExchangeBlocker.mockResolvedValue('Este contenido ya figura en la actuación #2.'); show(); await search();
    expect(screen.queryByRole('button', { name: 'Recuperar para revisar' })).toBeNull(); expect(screen.getByRole('link', { name: 'Descargar anterior.pdf' })).toHaveAttribute('download', 'anterior.pdf');
  });
});
