import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PendingEvidenceThumbnail, type PendingEvidenceActions } from '../../pages/inspecciones/InspectionPendingEvidence';
import type { PendingInspectionEvidence } from '../../services/inspectionOfflineEvidence';

const evidence: PendingInspectionEvidence = {
  id: 'pending-1', inspectionId: 'inspection-1', userId: 'inspector-1',
  file: new Blob(['GIF89a'], { type: 'image/gif' }), fileName: 'foto.gif', mimeType: 'image/gif',
  lastModified: 1, fields: { itemId: 'item-1', descripcion: 'Falta señalización.' },
  capturedAt: '2026-09-22T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', sha256: 'hash', attempts: 1,
  failureKind: 'terminal', lastError: 'Formato no permitido. Use JPG, PNG o WEBP.',
};
const actions: PendingEvidenceActions = { busy: false, online: true, onRetry: vi.fn(), onDiscard: vi.fn(), onReplace: vi.fn() };

describe('pending inspection evidence recovery controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:pending-photo');
    URL.revokeObjectURL = vi.fn();
  });

  it('shows the failure, comment, exact original download and manual retry', async () => {
    render(<PendingEvidenceThumbnail evidence={evidence} actions={actions} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Formato no permitido');
    expect(screen.getByText('Falta señalización.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Descargar copia original' })).toHaveAttribute('download', 'foto.gif');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await waitFor(() => expect(actions.onRetry).toHaveBeenCalledWith('pending-1'));
  });

  it('requires an explicit loss confirmation before discard and supports cancellation', async () => {
    render(<PendingEvidenceThumbnail evidence={evidence} actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar pendiente' }));
    expect(actions.onDiscard).not.toHaveBeenCalled();
    expect(screen.getByText(/Si es la única copia, perderás el original/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(actions.onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar pendiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar descarte' }));
    await waitFor(() => expect(actions.onDiscard).toHaveBeenCalledWith('pending-1'));
  });

  it('requires a replacement file and explicit loss confirmation', async () => {
    render(<PendingEvidenceThumbnail evidence={evidence} actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Corregir archivo' }));
    expect(screen.getByRole('button', { name: 'Confirmar reemplazo' })).toBeDisabled();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'corregida.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Archivo corregido: foto.gif'), { target: { files: [file] } });
    expect(actions.onReplace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reemplazo' }));
    await waitFor(() => expect(actions.onReplace).toHaveBeenCalledWith('pending-1', file));
  });

  it('cannot discard or replace an already confirmed server upload', () => {
    render(<PendingEvidenceThumbnail evidence={{ ...evidence, uploaded: true }} actions={actions} />);
    expect(screen.queryByRole('button', { name: 'Descartar pendiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corregir archivo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar sincronización' })).toBeVisible();
  });

  it('keeps the current thumbnail and download URL alive after StrictMode effect replay', () => {
    let generated = 0;
    URL.createObjectURL = vi.fn(() => `blob:photo-${++generated}`);
    render(<StrictMode><PendingEvidenceThumbnail evidence={evidence} actions={actions} /></StrictMode>);
    const url = screen.getByRole('link', { name: 'Descargar copia original' }).getAttribute('href');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(url);
    expect(screen.getByRole('img')).toHaveAttribute('src', url);
  });
});
