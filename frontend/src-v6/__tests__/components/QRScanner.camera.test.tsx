import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import QRScanner from '../../components/QRScanner';

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
let getUserMedia: ReturnType<typeof vi.fn>;

function pendingStream() {
  let resolve!: (stream: MediaStream) => void;
  const promise = new Promise<MediaStream>((done) => { resolve = done; });
  return { promise, resolve };
}

function camera() {
  const track = { stop: vi.fn(), getCapabilities: () => ({}) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { track, stream };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

it.each([['NotFoundError', 'Volver'], ['NotReadableError', 'Cancelar']])('keeps the escape button readable on the dark scanner after %s', async (name, label) => {
  getUserMedia.mockRejectedValue(new DOMException('QA unavailable camera', name));
  const close = vi.fn();
  render(<QRScanner onScan={vi.fn()} onClose={close} />);
  const back = await screen.findByRole('button', { name: label, exact: true });
  expect(back).toHaveClass('bg-white', 'text-neutral-900', 'hover:text-neutral-900');
  expect(back).not.toHaveClass('text-white');
  fireEvent.click(back);
  expect(close).toHaveBeenCalledOnce();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
});

it('stops a camera stream that arrives after the scanner has unmounted', async () => {
  const late = pendingStream();
  const capture = camera();
  getUserMedia.mockReturnValue(late.promise);
  const { unmount } = render(<QRScanner onScan={vi.fn()} onClose={vi.fn()} />);
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => { late.resolve(capture.stream); await late.promise; });
  expect(capture.track.stop).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

it('stops a replacement stream that arrives after closing during a camera switch', async () => {
  const initial = camera(), replacement = camera(), late = pendingStream();
  getUserMedia.mockResolvedValueOnce(initial.stream).mockReturnValueOnce(late.promise);
  const { unmount } = render(<QRScanner onScan={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cambiar camara' }));
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  expect(initial.track.stop).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => { late.resolve(replacement.stream); await late.promise; });
  expect(replacement.track.stop).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
});

it('stops an already acquired camera when the scanner unmounts (control)', async () => {
  const capture = camera();
  getUserMedia.mockResolvedValue(capture.stream);
  const { unmount } = render(<QRScanner onScan={vi.fn()} onClose={vi.fn()} />);
  await screen.findByRole('button', { name: 'Cambiar camara' });
  unmount();
  expect(capture.track.stop).toHaveBeenCalledTimes(1);
});

it('invalidates a pending acquisition immediately when close is clicked', async () => {
  const late = pendingStream(), capture = camera(), onClose = vi.fn();
  getUserMedia.mockReturnValue(late.promise);
  render(<QRScanner onScan={vi.fn()} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar escaner' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => { late.resolve(capture.stream); await late.promise; });
  expect(capture.track.stop).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

it('keeps the newest camera in StrictMode when the first request resolves last', async () => {
  const oldRequest = pendingStream(), oldCamera = camera(), activeCamera = camera();
  getUserMedia.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(activeCamera.stream);
  const { unmount } = render(<React.StrictMode><QRScanner onScan={vi.fn()} onClose={vi.fn()} /></React.StrictMode>);
  await screen.findByRole('button', { name: 'Cambiar camara' });
  await act(async () => { oldRequest.resolve(oldCamera.stream); await oldRequest.promise; });
  expect(oldCamera.track.stop).toHaveBeenCalledTimes(1);
  expect(activeCamera.track.stop).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  unmount();
  expect(activeCamera.track.stop).toHaveBeenCalledTimes(1);
});
