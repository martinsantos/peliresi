import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, ToastContainer } from '../../components/ui/Toast';

const ids: string[] = [];
afterEach(() => { act(() => ids.forEach(id => toast.remove(id))); ids.length = 0; vi.useRealTimers(); });

describe('system notices', () => {
  it('shows a notice emitted just before the container mounts', () => {
    ids.push(toast.success('Guardado confirmado'));
    render(<ToastContainer />);
    expect(screen.getByRole('status')).toHaveTextContent('Guardado confirmado');
  });
  it('does not stack identical connection failures and provides a real dismissal button', () => {
    render(<ToastContainer />);
    act(() => { ids.push(toast.error('Sin conexión', 'El borrador sigue en este dispositivo.')); ids.push(toast.error('Sin conexión', 'El borrador sigue en este dispositivo.')); });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const close = screen.getByRole('button', { name: 'Cerrar notificación' });
    expect(close).toHaveAttribute('type', 'button');
    fireEvent.click(close);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('honors duration zero and does not truncate an actionable error explanation', () => {
    vi.useFakeTimers();
    render(<ToastContainer />);
    act(() => { ids.push(toast.add({ type: 'error', title: 'No se pudo guardar', message: 'Revisá la conexión y volvé a intentar.', duration: 0 })); });
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByText('Revisá la conexión y volvé a intentar.').className).not.toContain('line-clamp');
  });
});
