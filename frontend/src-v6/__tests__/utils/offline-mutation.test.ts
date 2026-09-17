import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addToSyncQueue, createEncryptedMultipartPayload } from '../../services/indexeddb';
import { offlineSafeMultipartMutation } from '../../utils/offline-mutation';

vi.mock('../../services/indexeddb', () => ({
  addToSyncQueue: vi.fn().mockResolvedValue(undefined),
  createEncryptedMultipartPayload: vi.fn().mockResolvedValue({
    __kind: 'encrypted-multipart-v1',
    fields: { tipo: 'CONSTANCIA_AFIP' },
    keyId: 'key-1',
    file: { ciphertext: new ArrayBuffer(8), iv: new ArrayBuffer(12), name: 'doc.pdf', type: 'application/pdf', lastModified: 1 },
  }),
}));

describe('offlineSafeMultipartMutation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encrypts and queues a document when the API is unreachable', async () => {
    const file = new File(['document'], 'doc.pdf', { type: 'application/pdf' });
    const result = await offlineSafeMultipartMutation(
      () => Promise.reject(new Error('Network Error')),
      {
        endpoint: '/actores/generador/gen-1/documentos-regulatorios',
        fields: { tipo: 'CONSTANCIA_AFIP' },
        file,
        userId: 'user-1',
      },
    );

    expect(result).toBe('QUEUED');
    expect(createEncryptedMultipartPayload).toHaveBeenCalledWith({ tipo: 'CONSTANCIA_AFIP' }, file, 'user-1');
    expect(addToSyncQueue).toHaveBeenCalledWith(expect.objectContaining({
      type: 'POST',
      endpoint: '/actores/generador/gen-1/documentos-regulatorios',
      userId: 'user-1',
    }));
  });

  it('does not queue a backend validation error', async () => {
    const error = { response: { status: 409, data: { code: 'DOCUMENTO_YA_REGISTRADO' } } };
    const file = new File(['document'], 'doc.pdf', { type: 'application/pdf' });
    await expect(offlineSafeMultipartMutation(
      () => Promise.reject(error),
      { endpoint: '/atm', fields: {}, file, userId: 'user-1' },
    )).rejects.toBe(error);
    expect(addToSyncQueue).not.toHaveBeenCalled();
  });
});
