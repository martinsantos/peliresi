import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupportAudioInput } from '../../components/SupportAudioInput';
import { SUPPORT_AUDIO_LIMIT, recordingMime } from '../../utils/supportAudio';

let current: FakeRecorder;
const trackStop = vi.fn();
const acquire = vi.fn();
class FakeRecorder {
  static isTypeSupported = (mime: string) => mime.startsWith('audio/webm');
  state = 'inactive'; mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { current = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['unit audio bytes'], { type: this.mimeType }) }); this.onstop?.(); }
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: acquire } });
  acquire.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qa-audio'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('negotiates an available audio format and never chooses a video codec', () => {
  expect(recordingMime(FakeRecorder as never)).toBe('audio/webm;codecs=opus');
  expect(recordingMime({ isTypeSupported: () => false })).toBeUndefined();
});
it('requests microphone only on click and produces one optional attachment after stopping', async () => {
  const change = vi.fn(), busy = vi.fn(); render(<SupportAudioInput value={null} onChange={change} onBusyChange={busy} />);
  expect(acquire).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Terminar grabación' })).toBeEnabled());
  expect(acquire).toHaveBeenCalledExactlyOnceWith({ audio: true, video: false });
  fireEvent.click(screen.getByRole('button', { name: 'Terminar grabación' }));
  expect(change).toHaveBeenCalledOnce(); expect(change.mock.calls[0][0]).toBeInstanceOf(File);
  expect(trackStop).toHaveBeenCalled(); expect(busy.mock.calls.map(call => call[0])).toEqual([true, false]);
});
it('cancels without producing an attachment and releases microphone tracks', async () => {
  const change = vi.fn(); render(<SupportAudioInput value={null} onChange={change} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' })); await screen.findByRole('button', { name: 'Cancelar grabación' });
  await waitFor(() => expect(current.state).toBe('recording')); fireEvent.click(screen.getByRole('button', { name: 'Cancelar grabación' }));
  expect(change).not.toHaveBeenCalled(); expect(trackStop).toHaveBeenCalled();
});
it('releases a late microphone permission after the form unmounts', async () => {
  let resolve!: (value: unknown) => void; acquire.mockImplementation(() => new Promise(done => { resolve = done; }));
  const change = vi.fn(); const view = render(<SupportAudioInput value={null} onChange={change} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' })); view.unmount();
  await act(async () => resolve({ getTracks: () => [{ stop: trackStop }] }));
  expect(trackStop).toHaveBeenCalledOnce(); expect(change).not.toHaveBeenCalled();
});
it('closes an active recorder on unmount without generating a ticket attachment', async () => {
  const change = vi.fn(); const view = render(<SupportAudioInput value={null} onChange={change} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' })); await waitFor(() => expect(current.state).toBe('recording')); view.unmount();
  expect(current.state).toBe('inactive'); expect(trackStop).toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
});
it('rejects excessive audio even when its last packet arrives after recording stops', async () => {
  const change = vi.fn(); render(<SupportAudioInput value={null} onChange={change} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' })); await waitFor(() => expect(current.state).toBe('recording'));
  await act(async () => { current.state = 'inactive'; current.ondataavailable?.({ data: new Blob([new Uint8Array(SUPPORT_AUDIO_LIMIT + 1)]) }); current.onstop?.(); });
  expect(change).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('superó 5 MB'); expect(trackStop).toHaveBeenCalled();
});
it('does not block text entry after microphone permission is denied', async () => {
  acquire.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
  const busy = vi.fn(); render(<SupportAudioInput value={null} onChange={vi.fn()} onBusyChange={busy} />);
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Podés escribir');
  expect(screen.getByRole('button', { name: 'Grabar audio' })).toBeEnabled(); expect(busy).toHaveBeenLastCalledWith(false);
});
it('revokes preview object URLs when an optional clip is removed', () => {
  const clip = new File(['audio'], 'clip.webm', { type: 'audio/webm' });
  const change = vi.fn(); const view = render(<SupportAudioInput value={clip} onChange={change} onBusyChange={vi.fn()} />);
  expect(screen.getByLabelText('Escuchar audio antes de enviarlo')).toHaveAttribute('src', 'blob:qa-audio');
  fireEvent.click(screen.getByRole('button', { name: 'Quitar audio' })); expect(change).toHaveBeenCalledWith(null);
  view.rerender(<SupportAudioInput value={null} onChange={change} onBusyChange={vi.fn()} />);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qa-audio');
});
it('stops automatically at two minutes and leaves no zombie interval', async () => {
  const change = vi.fn(); const view = render(<SupportAudioInput value={null} onChange={change} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Grabar audio' }));
  await waitFor(() => expect(current.state).toBe('recording'));
  // Timer was acquired before fake time; move Date.now forward and let its
  // actual next tick exercise the deadline without sleeping two minutes.
  const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 121000);
  await waitFor(() => expect(change).toHaveBeenCalledOnce(), { timeout: 1500 });
  expect(current.state).toBe('inactive'); expect(trackStop).toHaveBeenCalled(); view.unmount();
});
