import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SWUpdateBanner } from '../../components/SWUpdateBanner';

const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(navigator, 'serviceWorker', original);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('app update while an inspection is open', () => {
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
