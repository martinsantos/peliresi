import { describe, expect, it } from 'vitest';
import { classifySyncFailure } from '../../services/indexeddb';

describe('offline sync failure classification', () => {
  it('blocks the queue for authentication failures', () => {
    expect(classifySyncFailure({ response: { status: 401, data: { message: 'Sesion vencida' } } })).toEqual({
      failureKind: 'auth',
      lastError: 'Sesion vencida',
    });
  });

  it('isolates validation failures as terminal for only that action', () => {
    expect(classifySyncFailure({ response: { status: 422, data: { message: 'Dato invalido' } } }).failureKind).toBe('terminal');
  });

  it('retries network and throttling failures', () => {
    expect(classifySyncFailure(new Error('offline')).failureKind).toBe('retryable');
    expect(classifySyncFailure({ response: { status: 429 } }).failureKind).toBe('retryable');
  });
});
