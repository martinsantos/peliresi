import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SWUpdateBanner } from '../../components/SWUpdateBanner';

const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(navigator, 'serviceWorker', original);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('app update while an inspection is open', () => {
  it('does not replace a screen with unfinished local input', async () => {
    const postMessage = vi.fn();
    const registration = { waiting: { postMessage }, installing: null, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {}, ready: Promise.resolve(registration), addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    render(<SWUpdateBanner localBlockReason="Terminá de ingresar o borrá los datos antes de actualizar." />);
    fireEvent.click(await screen.findByRole('button', { name: /Nueva versión disponible/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Terminá de ingresar');
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('observes a worker that was already installing before the banner mounted', async () => {
    let state: ServiceWorkerState = 'installing';
    const worker = new EventTarget();
    Object.defineProperty(worker, 'state', { get: () => state });
    const registration = { waiting: null, installing: worker, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {}, ready: Promise.resolve(registration), addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    render(<SWUpdateBanner />);
    await act(async () => { await Promise.resolve(); });
    state = 'installed';
    act(() => worker.dispatchEvent(new Event('statechange')));
    expect(await screen.findByRole('button', { name: /Nueva versión disponible/ })).toBeInTheDocument();
  });

  it('keeps the current version when the inspection reports unsent field work', async () => {
    const postMessage = vi.fn();
    const registration = { waiting: { postMessage }, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {}, ready: Promise.resolve(registration), addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    const protect = (event: Event) => {
      const update = event as CustomEvent<{ reason?: string }>;
      update.preventDefault();
      update.detail.reason = 'Guardá los cambios en el servidor antes de actualizar.';
    };
    window.addEventListener('sitrep:before-app-update', protect);
    try {
      render(<SWUpdateBanner />);
      fireEvent.click(await screen.findByRole('button', { name: /Nueva versión disponible/ }));
      expect(screen.getByRole('alert')).toHaveTextContent('Guardá los cambios');
      expect(postMessage).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('sitrep:before-app-update', protect);
    }
  });
});
