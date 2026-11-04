import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallPWAModal } from '../../components/InstallPWAModal';
import { usePWAInstall } from '../../hooks/usePWAInstall';

vi.mock('../../hooks/usePWAInstall', () => ({ usePWAInstall: vi.fn() }));

describe('installation guidance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('sitrep_pwa_dismiss');
    vi.mocked(usePWAInstall).mockReturnValue({
      canInstall: true, isInstalled: false, isIOS: false, promptInstall: vi.fn(),
    });
  });
  afterEach(() => {
    cleanup();
    localStorage.removeItem('sitrep_pwa_dismiss');
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('explains the connection limits and lets the user dismiss the invitation', () => {
    render(<InstallPWAModal />);
    act(() => vi.advanceTimersByTime(45_000));
    expect(screen.getByText('Consultá algunas pantallas guardadas sin conexión')).toBeInTheDocument();
    expect(screen.getByText('Revisá los avisos con la app abierta')).toBeInTheDocument();
    expect(screen.getByText('Para enviar cambios y recibir avisos necesitás conexión.')).toBeInTheDocument();
    expect(screen.queryByText('Funciona sin conexion a internet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar invitación a instalar' }));
    expect(screen.queryByText('Instalá SITREP')).not.toBeInTheDocument();
    expect(localStorage.getItem('sitrep_pwa_dismiss')).toBeTruthy();
  });

  it('keeps the manual installation instructions on iOS', () => {
    vi.mocked(usePWAInstall).mockReturnValue({
      canInstall: false, isInstalled: false, isIOS: true, promptInstall: vi.fn(),
    });
    render(<InstallPWAModal />);
    act(() => vi.advanceTimersByTime(45_000));
    expect(screen.getByText('Agregá SITREP a tu pantalla')).toBeInTheDocument();
    expect(screen.getByText('Compartir')).toBeInTheDocument();
    expect(screen.getByText('"Agregar a pantalla de inicio"')).toBeInTheDocument();
  });
});
