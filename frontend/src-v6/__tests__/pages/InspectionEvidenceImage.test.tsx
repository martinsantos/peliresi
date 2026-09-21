import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectionEvidenceImage } from '../../pages/inspecciones/InspectionEvidenceImage';
import { inspeccionService } from '../../services/inspeccion.service';

vi.mock('../../services/inspeccion.service', () => ({
  inspeccionService: {
    evidenceObjectUrl: vi.fn(),
  },
}));

describe('InspectionEvidenceImage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads the authenticated evidence and renders it as a thumbnail', async () => {
    vi.mocked(inspeccionService.evidenceObjectUrl).mockResolvedValue('blob:inspection-thumbnail');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const view = render(<InspectionEvidenceImage inspectionId="inspection-1" evidenceId="evidence-1" alt="Foto de campo" className="h-20 w-24" />);

    expect(screen.getByRole('img', { name: 'Cargando miniatura: Foto de campo' })).toBeInTheDocument();
    const image = await screen.findByAltText('Foto de campo');
    expect(image).toHaveAttribute('src', 'blob:inspection-thumbnail');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('decoding', 'sync');
    fireEvent.load(image);
    expect(image).toHaveAttribute('data-loaded', 'true');
    expect(screen.queryByRole('img', { name: 'Cargando miniatura: Foto de campo' })).not.toBeInTheDocument();
    expect(inspeccionService.evidenceObjectUrl).toHaveBeenCalledWith('inspection-1', 'evidence-1');

    view.unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:inspection-thumbnail'));
  });
});
