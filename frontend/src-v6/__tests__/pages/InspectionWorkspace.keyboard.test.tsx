import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionWorkspace } from '../../pages/inspecciones/InspectionWorkspace';

class VisibleViewport extends EventTarget {
  height = 783; offsetTop = 0;
}
function setup() {
  return render(<MemoryRouter><InspectionWorkspace guided defaultStep="acta" onBeforeNavigate={vi.fn()}
    steps={[{ id: 'acta', label: 'Registro', title: 'Observación', description: '', content: <textarea aria-label="Observación de campo" /> }]}
    reference={[]} saveAction={<button>Guardar cambios</button>} /></MemoryRouter>);
}
describe('inspection workspace follows the keyboard without floating save controls', () => {
  beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; }); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('caps the complete panel at the actual visible bottom, including viewport panning', () => {
    const viewport = new VisibleViewport(); vi.stubGlobal('visualViewport', viewport);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    setup();
    const panel = screen.getByTestId('inspection-workspace');
    expect(panel.style.maxHeight).toBe('671px');
    const input = screen.getByRole('textbox', { name: 'Observación de campo' }); input.focus();
    fireEvent.change(input, { target: { value: 'Testimonio conservado con teclado abierto' } });
    act(() => { viewport.height = 471; viewport.offsetTop = 175; viewport.dispatchEvent(new Event('resize')); });
    expect(panel.style.maxHeight).toBe('534px');
    expect(input).toHaveFocus(); expect(input).toHaveValue('Testimonio conservado con teclado abierto');
    expect(screen.getByTestId('inspection-action-bar').className).not.toMatch(/\b(sticky|fixed|absolute)\b/);
    act(() => { viewport.offsetTop = 100; viewport.dispatchEvent(new Event('scroll')); });
    expect(panel.style.maxHeight).toBe('459px');
    act(() => { viewport.height = 783; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')); });
    expect(panel.style.maxHeight).toBe('671px'); expect(input).toHaveFocus();
  });
  it('ignores invalid transient geometry and releases its passive listeners on unmount', () => {
    const viewport = new VisibleViewport(); vi.stubGlobal('visualViewport', viewport);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    const add = vi.spyOn(viewport, 'addEventListener'), remove = vi.spyOn(viewport, 'removeEventListener');
    const { unmount } = setup(); const panel = screen.getByTestId('inspection-workspace');
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    act(() => { viewport.height = 0; viewport.dispatchEvent(new Event('resize')); });
    expect(panel.style.maxHeight).toBe('671px');
    act(() => { viewport.height = Number.NaN; viewport.dispatchEvent(new Event('scroll')); });
    expect(panel.style.maxHeight).toBe('671px');
    unmount(); expect(remove).toHaveBeenCalledWith('resize', add.mock.calls[0][1]);
    expect(remove).toHaveBeenCalledWith('scroll', add.mock.calls[1][1]);
    expect(panel.style.maxHeight).toBe('');
  });
  it('retains the CSS fallback without a visualViewport API', () => {
    vi.stubGlobal('visualViewport', undefined); setup();
    expect(screen.getByTestId('inspection-workspace').style.maxHeight).toBe('');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });
  it('uses one scroll surface instead of zero-height fields when chrome consumes the available panel', () => {
    const viewport = new VisibleViewport(); viewport.height = 471; vi.stubGlobal('visualViewport', viewport);
    let parentHeight = 178;
    let notify: ResizeObserverCallback;
    const observed: Element[] = [], disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { notify = callback; }
      observe(element: Element) { observed.push(element); }
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const id = this.getAttribute('data-testid');
      return { top: id === 'inspection-workspace' ? 192 : 0,
        height: id === 'inspection-navigation' ? 114 : id === 'inspection-action-bar' ? 69 : parentHeight } as DOMRect;
    });
    const { unmount } = setup();
    const panel = screen.getByTestId('inspection-workspace'), content = screen.getByTestId('inspection-scroll-region');
    const input = screen.getByRole('textbox', { name: 'Observación de campo' }); input.focus();
    fireEvent.change(input, { target: { value: 'Comentario con teclado, sin perder el campo' } });
    expect(panel).toHaveAttribute('data-constrained-viewport', 'true');
    expect(panel).toHaveAttribute('data-inspection-scroll');
    expect(content).not.toHaveAttribute('data-inspection-scroll');
    expect(panel.className).toContain('overflow-y-auto');
    expect(content.className).toContain('shrink-0 overflow-visible');
    expect(screen.getByTestId('inspection-navigation').className).not.toContain('sticky');
    panel.scrollTop = 37; fireEvent.scroll(panel);
    // Parent layout can settle after the visualViewport event. Observe that
    // geometry rather than retaining the obsolete keyboard cap indefinitely.
    act(() => { viewport.height = 783; parentHeight = 600; notify!([], {} as ResizeObserver); });
    expect(panel).not.toHaveAttribute('data-constrained-viewport');
    expect(content).toHaveAttribute('data-inspection-scroll');
    expect(content.scrollTop).toBe(37);
    expect(screen.getByRole('textbox', { name: 'Observación de campo' })).toBe(input);
    expect(input).toHaveFocus(); expect(input).toHaveValue('Comentario con teclado, sin perder el campo');
    expect(observed).toContain(panel.parentElement);
    unmount(); expect(disconnect).toHaveBeenCalledOnce();
  });
});
