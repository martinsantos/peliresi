import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActorRegistrationDraft } from '../../hooks/useActorRegistrationDraft';
import { readRegistrationDraft, writeRegistrationDraft } from '../../services/registrationDraft';
const mock = vi.hoisted(() => ({ get: vi.fn(), token: '', canWrite: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: mock.get }, getAccessToken: () => mock.token }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: () => ({ status: 'owned', canWrite: mock.canWrite, retry: vi.fn() }) }));
const session = (id: string) => `qa.${btoa(JSON.stringify({ id }))}.qa`;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mock.token = session('admin'); mock.canWrite.mockReturnValue(true);
  mock.get.mockResolvedValue({ data: { data: { user: { id: 'admin' } } } }); });
describe('all administrative actor drafts use a verified account and actual saved documents', () => {
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as const)('%s persists and recovers without a password or actor creation', async type => {
    const restore = vi.fn(), data = { form: { razonSocial: 'QA', cuit: '30-12345678-9', password: 'DO-NOT-STORE' }, step: 2 };
    const first = renderHook(() => useActorRegistrationDraft(type, undefined, data, restore, true));
    await waitFor(() => expect(first.result.current.saved).toBe(true));
    expect(readRegistrationDraft('admin', `admin:${type}:new`)?.data.form).toEqual({ razonSocial: 'QA', cuit: '30-12345678-9' });
    first.unmount(); const second = renderHook(() => useActorRegistrationDraft(type, undefined, {}, restore, false));
    await waitFor(() => expect(second.result.current.available).not.toBeNull());
    await act(async () => second.result.current.restore());
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ form: { razonSocial: 'QA', cuit: '30-12345678-9' } }));
  });
  it('keeps a partial registration on the server and reads confirmed documents rather than trusting local saved labels', async () => {
    writeRegistrationDraft('admin', 'admin:GENERADOR:new', { form: { cuit: '30-12345678-9' }, savedActorId: 'created', uploadedDocs: { FAKE: 'not-uploaded.pdf' } });
    mock.get.mockImplementation(async url => ({ data: { data: url === '/auth/profile' ? { user: { id: 'admin' } }
      : url.endsWith('/documentos') ? { documentos: [{ id: 'doc', tipo: 'MEMORIA_TECNICA', nombre: 'real.pdf' }] }
      : { generador: { id: 'created', cuit: '30-12345678-9' } } } }));
    const restore = vi.fn(); const { result } = renderHook(() => useActorRegistrationDraft('GENERADOR', undefined, {}, restore, false));
    await waitFor(() => expect(result.current.available).not.toBeNull()); await act(async () => result.current.restore());
    expect(restore.mock.calls[0][0].uploadedDocs).toEqual({ MEMORIA_TECNICA: 'real.pdf' });
    expect(mock.get).toHaveBeenCalledWith('/actores/generadores/created/documentos');
  });
  it('does not adopt a fabricated saved actor belonging to another CUIT', async () => {
    writeRegistrationDraft('admin', 'admin:GENERADOR:new', { form: { cuit: '30-12345678-9' }, savedActorId: 'foreign' });
    mock.get.mockImplementation(async url => ({ data: { data: url === '/auth/profile' ? { user: { id: 'admin' } } : { generador: { cuit: '30-99999999-9' } } } }));
    const restore = vi.fn(); const { result } = renderHook(() => useActorRegistrationDraft('GENERADOR', undefined, {}, restore, false));
    await waitFor(() => expect(result.current.available).not.toBeNull()); await act(async () => result.current.restore());
    expect(restore).not.toHaveBeenCalled(); expect(result.current.error).toContain('no coincide');
  });
  it('blocks saving after an account switch and leaves the first account draft intact', async () => {
    const { result } = renderHook(() => useActorRegistrationDraft('OPERADOR', undefined, { form: { razonSocial: 'PRIVATE-QA' } }, vi.fn(), true));
    await waitFor(() => expect(result.current.saved).toBe(true)); mock.token = session('other');
    act(() => { expect(result.current.checkpoint()).toBe(false); });
    expect(readRegistrationDraft('other', 'admin:OPERADOR:new')).toBeNull(); expect(readRegistrationDraft('admin', 'admin:OPERADOR:new')).not.toBeNull();
  });
  it('clears the visible form on an account boundary without copying the previous private draft into the new account', async () => {
    const { result, rerender } = renderHook(() => {
      const [data, restore] = useState<Record<string, unknown>>({ form: { razonSocial: 'PRIVATE-OLD-ACCOUNT' } });
      return useActorRegistrationDraft('GENERADOR', undefined, data, restore, Boolean(data.form));
    });
    await waitFor(() => expect(result.current.saved).toBe(true));
    mock.token = session('other'); mock.get.mockResolvedValue({ data: { data: { user: { id: 'other' } } } }); rerender();
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
    expect(readRegistrationDraft('other', 'admin:GENERADOR:new')).toBeNull();
    expect(readRegistrationDraft('admin', 'admin:GENERADOR:new')?.data.form).toEqual({ razonSocial: 'PRIVATE-OLD-ACCOUNT' });
  });
});
