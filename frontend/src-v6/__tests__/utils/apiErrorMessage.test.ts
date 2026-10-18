import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { getApiErrorMessage } from '../../utils/api-error';

const fallback = 'Revisá la conexión y reintentá; los datos siguen en pantalla.';

describe('getApiErrorMessage', () => {
  it.each([
    ['ERR_NETWORK', 'Network Error'],
    ['ECONNABORTED', 'timeout of 30000ms exceeded'],
  ])('uses the Spanish fallback for transport failure %s', (code, message) => {
    expect(getApiErrorMessage(new AxiosError(message, code), fallback)).toBe(fallback);
  });

  it('uses the fallback for an HTTP failure without a server message', () => {
    const error = new AxiosError('Request failed with status code 502', 'ERR_BAD_RESPONSE');
    error.response = { status: 502, data: '<html>', statusText: '', headers: {}, config: {} as never };
    expect(getApiErrorMessage(error, fallback)).toBe(fallback);
  });

  it('keeps the server message', () => {
    const error = new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST');
    error.response = { status: 409, data: { message: 'El CUIT ya tiene una solicitud abierta' }, statusText: '', headers: {}, config: {} as never };
    expect(getApiErrorMessage(error, fallback)).toBe('El CUIT ya tiene una solicitud abierta');
  });

  it('keeps messages of errors raised by the application', () => {
    expect(getApiErrorMessage(new Error('La sesión cambió o no está verificada.'), fallback)).toBe('La sesión cambió o no está verificada.');
  });

  it('falls back for values that are not errors', () => {
    expect(getApiErrorMessage(undefined, fallback)).toBe(fallback);
    expect(getApiErrorMessage({ message: '  ' }, fallback)).toBe(fallback);
  });
});
