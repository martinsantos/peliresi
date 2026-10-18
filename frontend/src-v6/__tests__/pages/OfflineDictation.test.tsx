import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineDictation } from '../../pages/inspecciones/OfflineDictation';
import { appendDictatedText } from '../../pages/inspecciones/appendDictatedText';
import type { DictationEvents } from '../../services/localDictation';
const mock = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }));
vi.mock('../../services/localDictation', () => ({ startLocalDictation: mock.start }));
describe('local PCM dictation', () => {
  let events: DictationEvents;
  beforeEach(() => {
    vi.clearAllMocks();
    mock.stop.mockResolvedValue(undefined);
    mock.start.mockImplementation(async (callbacks: DictationEvents) => { events = callbacks; callbacks.onPhase('listening'); return { stop: mock.stop, cancel: mock.cancel }; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  it('opens only on a tap and adds recognized phrases while showing provisional text', async () => {
    const onText = vi.fn(); const onActiveChange = vi.fn();
    render(<OfflineDictation onText={onText} onActiveChange={onActiveChange} />);
    expect(mock.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dictar', exact: true }));
    await screen.findByRole('button', { name: 'Detener dictado' });
    act(() => events.onPartial('residuos en'));
    expect(onText).not.toHaveBeenCalled();
    expect(screen.getByText('residuos en')).toBeInTheDocument();
    act(() => events.onText('residuos en el depósito'));
    expect(onText).toHaveBeenCalledExactlyOnceWith('residuos en el depósito');
    fireEvent.click(screen.getByRole('button', { name: 'Detener dictado' }));
    await waitFor(() => expect(onActiveChange).toHaveBeenLastCalledWith(false));
    expect(mock.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Texto incorporado');
  });
  it('gives an actionable permission error and allows retry without discarding text', async () => {
    mock.start.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    render(<OfflineDictation onText={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar', exact: true }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Micrófono bloqueado'));
    fireEvent.click(screen.getByRole('button', { name: 'Dictar', exact: true }));
    await screen.findByRole('button', { name: 'Detener dictado' });
    expect(mock.start).toHaveBeenCalledTimes(2);
  });
  it('cancels a pending permission or model preparation and ignores late completion', async () => {
    let resolve!: (session: { stop: typeof mock.stop; cancel: typeof mock.cancel }) => void;
    mock.start.mockImplementation(() => new Promise(done => { resolve = done; }));
    const onText = vi.fn();
    render(<OfflineDictation onText={onText} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar preparación del dictado' }));
    expect(mock.start.mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolve({ stop: mock.stop, cancel: mock.cancel }));
    expect(mock.cancel).toHaveBeenCalledOnce();
    expect(onText).not.toHaveBeenCalled();
  });
  it('stops and flushes when changing the section', async () => {
    const onText = vi.fn();
    const view = render(<OfflineDictation onText={onText} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar', exact: true }));
    await screen.findByRole('button', { name: 'Detener dictado' });
    view.rerender(<OfflineDictation onText={onText} active={false} />);
    await waitFor(() => expect(mock.stop).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dictar', exact: true })).toBeDisabled());
  });
  it('releases the microphone when unmounted', async () => {
    const view = render(<OfflineDictation onText={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar', exact: true }));
    await screen.findByRole('button', { name: 'Detener dictado' });
    view.unmount();
    expect(mock.cancel).toHaveBeenCalledOnce();
    expect(mock.start.mock.calls[0][1].aborted).toBe(true);
  });
  it('appends without changing existing testimony', () => {
    expect(appendDictatedText('Envases abiertos.', '  olor fuerte  ')).toBe('Envases abiertos. olor fuerte');
    expect(appendDictatedText('Línea inicial\n', 'Segunda línea')).toBe('Línea inicial\nSegunda línea');
    expect(appendDictatedText('Original', '   ')).toBe('Original');
  });
});
