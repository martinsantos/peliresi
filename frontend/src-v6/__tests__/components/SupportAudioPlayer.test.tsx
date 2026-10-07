import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../../services/support.service', () => ({ supportService: mocks, supportError: () => 'No se pudo cargar el audio.' }));
import { SupportAudioPlayer } from '../../components/SupportAudioPlayer';
const file = { id: 'voice', nombre: 'voz.webm', mime: 'audio/webm', bytes: 100, sha256: 'unit-only' };
beforeEach(() => {
  mocks.download.mockReset(); mocks.download.mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' }));
  localStorage.setItem('sitrep_access_token', 'unit.' + btoa(JSON.stringify({ id: 'owner' })) + '.not-a-credential');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-voice'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it('loads an audio file only through the authenticated service after the user requests it', async () => {
  const view = render(<SupportAudioPlayer owner="owner" file={file} ticketId="ticket" />);
  expect(mocks.download).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Escuchar audio' }));
  expect(await screen.findByLabelText('Audio del ticket: voz.webm')).toHaveAttribute('src', 'blob:private-voice');
  expect(mocks.download).toHaveBeenCalledExactlyOnceWith('ticket', 'voice');
  view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-voice');
});
it('does not attach a private object URL after switching accounts during download', async () => {
  let complete!: (blob: Blob) => void; mocks.download.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(<SupportAudioPlayer owner="owner" file={file} ticketId="ticket" />); fireEvent.click(screen.getByRole('button', { name: 'Escuchar audio' }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
  localStorage.setItem('sitrep_access_token', 'unit.' + btoa(JSON.stringify({ id: 'foreign' })) + '.not-a-credential');
  await act(async () => complete(new Blob(['audio'], { type: 'audio/webm' })));
  expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Audio del ticket: voz.webm')).not.toBeInTheDocument();
});
it('rejects an HTML fallback rather than mounting it as audio', async () => {
  mocks.download.mockResolvedValue(new Blob(['<html>'], { type: 'text/html' }));
  render(<SupportAudioPlayer owner="owner" file={file} ticketId="ticket" />); fireEvent.click(screen.getByRole('button', { name: 'Escuchar audio' }));
  await screen.findByRole('alert'); expect(URL.createObjectURL).not.toHaveBeenCalled();
});
