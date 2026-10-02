import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../../components/ui/Modal';

class VisibleViewport extends EventTarget {
  width = 360;
  height = 760;
  offsetTop = 0;
  offsetLeft = 0;
  resize(height: number, top = 0, left = 0) {
    this.height = height;
    this.offsetTop = top;
    this.offsetLeft = left;
    this.dispatchEvent(new Event('resize'));
  }
}

describe('modal remains usable above the mobile keyboard', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const content = <input aria-label="Ubicación prevista" defaultValue="" />;
  const footer = <button type="button">Crear expediente</button>;
  const dialog = (isOpen = true) => <Modal isOpen={isOpen} title="Nueva inspección" onClose={vi.fn()} footer={footer}>{content}</Modal>;

  it('fits the visible viewport as the keyboard opens, keeping typed text and focus', async () => {
    const viewport = new VisibleViewport();
    vi.stubGlobal('visualViewport', viewport);
    render(dialog());
    // jsdom has no layout boxes, so the existing focus trap targets the dialog.
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    const input = screen.getByLabelText('Ubicación prevista');
    input.focus();
    fireEvent.change(input, { target: { value: 'Hallazgo en campo' } });
    act(() => viewport.resize(420, 90, 2));
    const modal = screen.getByRole('dialog');
    expect(modal.parentElement).toHaveStyle({ height: '420px', width: '360px', top: '90px', left: '2px' });
    expect(modal.style.maxHeight).toBe('min(94dvh, 388px)');
    expect(input).toHaveValue('Hallazgo en campo');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Crear expediente' })).toBeEnabled();
    act(() => viewport.resize(760));
    expect(modal.parentElement).toHaveStyle({ height: '760px', top: '0px' });
    expect(modal.style.maxHeight).toBe('min(94dvh, 728px)');
    expect(input).toHaveFocus();
  });

  it('follows visual viewport panning and ignores transient invalid dimensions', () => {
    const viewport = new VisibleViewport();
    vi.stubGlobal('visualViewport', viewport);
    render(dialog());
    act(() => { viewport.offsetTop = 50; viewport.dispatchEvent(new Event('scroll')); });
    const overlay = screen.getByRole('dialog').parentElement!;
    expect(overlay).toHaveStyle({ top: '50px', height: '760px' });
    act(() => viewport.resize(0));
    expect(overlay).toHaveStyle({ top: '50px', height: '760px' });
    act(() => viewport.resize(Number.NaN));
    expect(overlay).toHaveStyle({ top: '50px', height: '760px' });
  });

  it('removes subscriptions while closed and measures fresh dimensions when reopened', () => {
    const viewport = new VisibleViewport();
    const add = vi.spyOn(viewport, 'addEventListener');
    const remove = vi.spyOn(viewport, 'removeEventListener');
    vi.stubGlobal('visualViewport', viewport);
    const { rerender, unmount } = render(dialog());
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    rerender(dialog(false));
    expect(remove).toHaveBeenCalledWith('resize', add.mock.calls[0][1]);
    expect(remove).toHaveBeenCalledWith('scroll', add.mock.calls[1][1]);
    act(() => viewport.resize(500, 20));
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(dialog());
    expect(screen.getByRole('dialog').parentElement).toHaveStyle({ height: '500px', top: '20px' });
    unmount();
    expect(remove).toHaveBeenCalledTimes(4);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('retains the CSS fallback and normal dismissal without visualViewport support', () => {
    vi.stubGlobal('visualViewport', undefined);
    const close = vi.fn();
    render(<Modal isOpen title="Nueva inspección" onClose={close}>{content}</Modal>);
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('max-h-[94dvh]');
    expect(modal.style.maxHeight).toBe('');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
