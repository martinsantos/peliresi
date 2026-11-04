import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedSyntheticPreviewOrigin, SyntheticPreviewGate } from '../../components/SyntheticPreviewGate';

const origin = 'http://127.0.0.1:4177';
const ok = () => ({ ok: true, json: async () => ({ mode: 'synthetic-preview-v1' }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('isolated preview gate', () => {
  it('does not change ordinary operation or contact the preview endpoint', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<SyntheticPreviewGate enabled={false}><p>Operación</p></SyntheticPreviewGate>);
    expect(screen.getByText('Operación')).toBeVisible();
    expect(screen.queryByText(/ENTORNO DE PRÁCTICA/)).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('checks the configured origin and rejects production or insecure external URLs', () => {
    expect(allowedSyntheticPreviewOrigin(origin, origin)).toBe(true);
    expect(allowedSyntheticPreviewOrigin('https://preview.example.invalid', 'https://preview.example.invalid')).toBe(true);
    expect(allowedSyntheticPreviewOrigin('https://sitrep.ultimamilla.com.ar', 'https://sitrep.ultimamilla.com.ar')).toBe(false);
    expect(allowedSyntheticPreviewOrigin('https://sitrep.ultimamilla.com.ar:8443', 'https://sitrep.ultimamilla.com.ar:8443')).toBe(true);
    expect(allowedSyntheticPreviewOrigin('https://sitrep.ultimamilla.com.ar:9443', 'https://sitrep.ultimamilla.com.ar:9443')).toBe(false);
    expect(allowedSyntheticPreviewOrigin('http://sitrep.ultimamilla.com.ar:8443', 'http://sitrep.ultimamilla.com.ar:8443')).toBe(false);
    expect(allowedSyntheticPreviewOrigin('https://sitrep.ultimamilla.com.ar.:8443', 'https://sitrep.ultimamilla.com.ar.:8443')).toBe(false);
    expect(allowedSyntheticPreviewOrigin('https://sitrep.ultimamilla.com.ar:8443', 'https://sitrep.ultimamilla.com.ar:8443/path')).toBe(false);
    expect(allowedSyntheticPreviewOrigin('https://sitrep.ultimamilla.com.ar', 'https://sitrep.ultimamilla.com.ar:8443')).toBe(false);
    expect(allowedSyntheticPreviewOrigin('http://preview.example.invalid', 'http://preview.example.invalid')).toBe(false);
    expect(allowedSyntheticPreviewOrigin(origin, 'https://preview.example.invalid')).toBe(false);
    expect(allowedSyntheticPreviewOrigin(origin, origin + '/path')).toBe(false);
  });
  it('holds the app until the isolated API confirms its identity', async () => {
    let finish!: (value: ReturnType<typeof ok>) => void;
    const fetch = vi.fn(() => new Promise<ReturnType<typeof ok>>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    render(<SyntheticPreviewGate enabled origin={origin} configuredOrigin={origin} apiBase="/api"><p>Formulario</p></SyntheticPreviewGate>);
    expect(screen.queryByText('Formulario')).toBeNull();
    expect(screen.getByText(/ENTORNO DE PRÁCTICA/)).toBeVisible();
    await act(async () => { finish(ok()); });
    expect(screen.getByText('Formulario')).toBeVisible();
    expect(fetch).toHaveBeenCalledWith('/api/preview/identity', expect.objectContaining({ cache: 'no-store', credentials: 'omit' }));
  });
  it('fails closed for an external API even when the displayed origin looks correct', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<SyntheticPreviewGate enabled origin={origin} configuredOrigin={origin} apiBase="https://sitrep.ultimamilla.com.ar/api"><p>Formulario</p></SyntheticPreviewGate>);
    expect(await screen.findByRole('heading', { name: /No se pudo verificar/ })).toBeVisible();
    expect(screen.queryByText('Formulario')).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('explains a failed identity check and retries without exposing the app', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ mode: 'production' }) }).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    render(<SyntheticPreviewGate enabled origin={origin} configuredOrigin={origin} apiBase="/api"><p>Formulario</p></SyntheticPreviewGate>);
    expect(await screen.findByRole('heading', { name: /No se pudo verificar/ })).toBeVisible();
    expect(screen.queryByText('Formulario')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Formulario')).toBeVisible(); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not reuse a successful check after the configured origin changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()));
    const view = render(<SyntheticPreviewGate enabled origin={origin} configuredOrigin={origin} apiBase="/api"><p>Formulario</p></SyntheticPreviewGate>);
    expect(await screen.findByText('Formulario')).toBeVisible();
    view.rerender(<SyntheticPreviewGate enabled origin={origin} configuredOrigin="https://other.example.invalid" apiBase="/api"><p>Formulario</p></SyntheticPreviewGate>);
    expect(screen.queryByText('Formulario')).toBeNull();
    expect(await screen.findByRole('heading', { name: /No se pudo verificar/ })).toBeVisible();
  });
  it('offers a retry when identity verification does not answer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })));
    render(<SyntheticPreviewGate enabled origin={origin} configuredOrigin={origin} apiBase="/api"><p>Formulario</p></SyntheticPreviewGate>);
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByRole('heading', { name: /No se pudo verificar/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(screen.queryByText('Formulario')).toBeNull();
  });
});
