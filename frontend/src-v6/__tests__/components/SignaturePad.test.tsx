import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignaturePad } from '../../components/ui/SignaturePad';

// JSDOM has no graphics engine. Adapt that boundary, not component state/events.
const drawing = { fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
const signature = 'data:image/png;base64,c3ludGhldGljLXRyYWNl';
const capture = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawing as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(signature);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open(onClear = vi.fn()) {
  render(<SignaturePad onConfirm={capture} onClear={onClear} />);
  return { canvas: screen.getByLabelText('Lienzo de firma') as HTMLCanvasElement, confirm: screen.getByRole('button', { name: 'Usar firma', exact: true }), onClear };
}
const at = (clientX: number, clientY: number) => ({ touches: [{ clientX, clientY }] });

describe('signature requires an actual drawn segment', () => {
  it('rejects a mouse down/up without drawing or serializing a blank image', () => {
    const { canvas, confirm } = open();
    expect(confirm).toBeDisabled();
    fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseUp(canvas, { clientX: 40, clientY: 40 });
    expect(drawing.stroke).not.toHaveBeenCalled();
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(capture).not.toHaveBeenCalled();
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });
  it('rejects stationary movement', () => {
    const { canvas, confirm } = open();
    fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseUp(canvas);
    expect(drawing.stroke).not.toHaveBeenCalled();
    expect(confirm).toBeDisabled();
  });
  it('captures a real mouse segment only on explicit confirmation', () => {
    const { canvas, confirm } = open();
    fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 80, clientY: 60 });
    fireEvent.mouseUp(canvas);
    expect(drawing.stroke).toHaveBeenCalledOnce();
    expect(confirm).toBeEnabled();
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    expect(capture).toHaveBeenCalledExactlyOnceWith(signature);
  });
  it('rejects a touch without a stroke', () => {
    const { canvas, confirm } = open();
    fireEvent.touchStart(canvas, at(40, 40));
    fireEvent.touchEnd(canvas, { touches: [] });
    expect(drawing.stroke).not.toHaveBeenCalled();
    expect(confirm).toBeDisabled();
  });
  it('captures a real touch segment and ignores later movement after release', () => {
    const { canvas, confirm } = open();
    fireEvent.touchStart(canvas, at(40, 40));
    fireEvent.touchMove(canvas, at(80, 60));
    fireEvent.touchEnd(canvas, { touches: [] });
    fireEvent.touchMove(canvas, at(100, 90));
    expect(drawing.stroke).toHaveBeenCalledOnce();
    fireEvent.click(confirm);
    expect(capture).toHaveBeenCalledExactlyOnceWith(signature);
  });
  it('does not continue drawing after native touch cancellation', () => {
    const { canvas, confirm } = open();
    fireEvent.touchStart(canvas, at(40, 40));
    fireEvent.touchCancel(canvas, { touches: [] });
    fireEvent.touchMove(canvas, at(80, 60));
    expect(drawing.stroke).not.toHaveBeenCalled();
    expect(confirm).toBeDisabled();
  });
  it('clearing cancels a current stroke and invalidates its previous image', () => {
    const { canvas, confirm, onClear } = open();
    fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 80, clientY: 60 });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar', exact: true }));
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 90 });
    expect(drawing.stroke).toHaveBeenCalledOnce();
    expect(confirm).toBeDisabled();
    expect(onClear).toHaveBeenCalledOnce();
    fireEvent.click(confirm);
    expect(capture).not.toHaveBeenCalled();
  });
  it('leaves confirmation disabled when canvas drawing is unavailable', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const { canvas, confirm } = open();
    fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 80, clientY: 60 });
    fireEvent.mouseUp(canvas);
    expect(confirm).toBeDisabled();
    expect(capture).not.toHaveBeenCalled();
  });
});
