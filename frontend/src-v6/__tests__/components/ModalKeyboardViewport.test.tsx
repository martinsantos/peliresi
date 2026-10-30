import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal, ConfirmModal } from '../../components/ui/Modal';

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

  it('keeps a rejected confirmation readable inside the active dialog and preserves the retry', () => {
    const confirm = vi.fn(), close = vi.fn();
    const renderDialog = (error = '') => <ConfirmModal isOpen title="Eliminar Usuario" onClose={close} onConfirm={confirm} error={error} confirmText="Si, eliminar" />;
    const { rerender } = render(renderDialog());
    fireEvent.click(screen.getByRole('button', { name: 'Si, eliminar' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    rerender(renderDialog('No se puede eliminar: tiene manifiestos.'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('tiene manifiestos');
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Si, eliminar' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    rerender(renderDialog());
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not steal focus from a field selected before deferred autofocus runs', () => {
    let focusFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { focusFrame = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(dialog());
    const input = screen.getByLabelText('Ubicación prevista');
    input.focus();
    expect(input).toHaveFocus();
    act(() => focusFrame!(0));
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Dato elegido por la persona' } });
    expect(input).toHaveValue('Dato elegido por la persona');
  });

  it('scrolls the focused field and its label into the available dialog body', async () => {
    render(<Modal isOpen title="Nueva inspección" onClose={vi.fn()}>
      <label htmlFor="field-reference">Ubicación prevista</label><input id="field-reference" />
    </Modal>);
    const modal = screen.getByRole('dialog');
    const input = within(modal).getByLabelText('Ubicación prevista');
    const label = within(modal).getByText('Ubicación prevista');
    const body = label.closest('.overflow-y-auto') as HTMLDivElement;
    const box = (top: number, height: number) => ({ x: 0, y: top, top, bottom: top + height, left: 0, right: 320, width: 320, height, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(box(0, 160));
    vi.spyOn(body, 'getClientRects').mockReturnValue([box(0, 160)] as unknown as DOMRectList);
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(box(70, 30));
    vi.spyOn(label, 'getClientRects').mockReturnValue([box(70, 30)] as unknown as DOMRectList);
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(box(110, 90));
    input.focus();
    await waitFor(() => expect(body.scrollTop).toBe(48));
    expect(input).toHaveFocus();
  });

  it('keeps the focused field and label visible when the visual viewport shrinks', async () => {
    const viewport = new VisibleViewport();
    vi.stubGlobal('visualViewport', viewport);
    render(<Modal isOpen title="Nueva inspección" onClose={vi.fn()}>
      <label htmlFor="field-resize">Ubicación prevista</label><input id="field-resize" />
    </Modal>);
    const modal = screen.getByRole('dialog'), input = within(modal).getByLabelText('Ubicación prevista');
    const label = within(modal).getByText('Ubicación prevista');
    const body = label.closest('.overflow-y-auto') as HTMLDivElement;
    const box = (top: number, height: number) => ({ x: 0, y: top, top, bottom: top + height, left: 0, right: 320, width: 320, height, toJSON: () => ({}) }) as DOMRect;
    let bodyHeight = 300;
    vi.spyOn(body, 'getBoundingClientRect').mockImplementation(() => box(0, bodyHeight));
    vi.spyOn(body, 'getClientRects').mockImplementation(() => [box(0, bodyHeight)] as unknown as DOMRectList);
    vi.spyOn(label, 'getBoundingClientRect').mockImplementation(() => box(70 - body.scrollTop, 30));
    vi.spyOn(label, 'getClientRects').mockImplementation(() => [box(70 - body.scrollTop, 30)] as unknown as DOMRectList);
    vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() => box(110 - body.scrollTop, 90));
    input.focus();
    act(() => { bodyHeight = 160; viewport.resize(420); });
    await waitFor(() => expect(body.scrollTop).toBe(48));
    expect(input).toHaveFocus();
  });

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
