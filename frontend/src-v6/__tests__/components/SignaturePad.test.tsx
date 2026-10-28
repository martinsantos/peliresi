import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignaturePad } from '../../components/ui/SignaturePad';
import { toast, ToastContainer } from '../../components/ui/Toast';

// JSDOM has no graphics engine. Adapt that boundary, not component state/events.
const drawing = { fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
const signature = 'data:image/png;base64,c3ludGhldGljLXRyYWNl';
const capture = vi.fn();
const noticeIds: string[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawing as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(signature);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); act(() => noticeIds.splice(0).forEach(id => toast.remove(id))); vi.useRealTimers(); vi.restoreAllMocks(); });
function open(onClear = vi.fn()) {
  render(<SignaturePad onConfirm={capture} onClear={onClear} />);
  return { canvas: screen.getByLabelText('Lienzo de firma') as HTMLCanvasElement, confirm: screen.getByRole('button', { name: 'Usar firma', exact: true }), onClear };
}
const at = (clientX: number, clientY: number) => ({ touches: [{ clientX, clientY }] });

describe('signature requires an actual drawn segment', () => {
  it('keeps the notice layout still during a stroke and delivers notices that arrive meanwhile', () => {
    vi.useFakeTimers();
    render(<><ToastContainer /><SignaturePad onConfirm={capture} /></>);
    act(() => { noticeIds.push(toast.add({type:'success',title:'Guardado',duration:1000})); });
    act(() => vi.advanceTimersByTime(900));
    const canvas=screen.getByLabelText('Lienzo de firma');
    fireEvent.mouseDown(canvas,{clientX:40,clientY:40});
    act(() => { noticeIds.push(toast.add({type:'warning',title:'Aviso nuevo',duration:1000})); vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Guardado')).toBeVisible();
    expect(screen.queryByText('Aviso nuevo')).not.toBeInTheDocument();
    fireEvent.mouseMove(canvas,{clientX:80,clientY:60});fireEvent.mouseUp(canvas);
    expect(screen.getByText('Aviso nuevo')).toBeVisible();
    expect(screen.getByRole('button',{name:'Usar firma'})).toBeEnabled();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
    expect(screen.getByText('Aviso nuevo')).toBeVisible();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByText('Aviso nuevo')).not.toBeInTheDocument();
  });
  it('releases a held notice if the pad is removed during a stroke', () => {
    vi.useFakeTimers();
    const rendered=render(<><ToastContainer /><SignaturePad onConfirm={capture} /></>);
    act(() => { noticeIds.push(toast.add({type:'info',title:'Aviso',duration:1000})); });
    fireEvent.touchStart(screen.getByLabelText('Lienzo de firma'),at(40,40));
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('Aviso')).toBeVisible();
    rendered.rerender(<ToastContainer />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Aviso')).not.toBeInTheDocument();
  });
  it.each(['cancelación táctil','pérdida de foco'])('resumes notice expiry after %s', reason => {
    vi.useFakeTimers();
    render(<><ToastContainer /><SignaturePad onConfirm={capture} /></>);
    act(() => { noticeIds.push(toast.add({type:'info',title:'Aviso',duration:1000})); });
    const canvas=screen.getByLabelText('Lienzo de firma');
    if(reason==='cancelación táctil')fireEvent.touchStart(canvas,at(40,40));else fireEvent.mouseDown(canvas,{clientX:40,clientY:40});
    act(() => vi.advanceTimersByTime(1500));expect(screen.getByText('Aviso')).toBeVisible();
    if(reason==='cancelación táctil')fireEvent.touchCancel(canvas,{touches:[]});else fireEvent.blur(window);
    act(() => vi.advanceTimersByTime(1000));expect(screen.queryByText('Aviso')).not.toBeInTheDocument();
  });
  it('waits for every active pad before revealing a new notice', () => {
    vi.useFakeTimers();
    render(<><ToastContainer /><SignaturePad onConfirm={capture} /><SignaturePad onConfirm={capture} /></>);
    const [first,second]=screen.getAllByLabelText('Lienzo de firma');
    fireEvent.touchStart(first,at(40,40));fireEvent.touchStart(second,at(80,80));
    act(() => { noticeIds.push(toast.add({type:'warning',title:'Aviso pendiente',duration:1000})); });
    fireEvent.touchCancel(first,{touches:[]});expect(screen.queryByText('Aviso pendiente')).not.toBeInTheDocument();
    fireEvent.touchCancel(second,{touches:[]});expect(screen.getByText('Aviso pendiente')).toBeVisible();
  });
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
