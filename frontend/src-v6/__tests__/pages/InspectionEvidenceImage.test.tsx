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

  it('opens an accessible full-screen preview and closes it with Escape', async () => {
    vi.mocked(inspeccionService.evidenceObjectUrl).mockResolvedValue('blob:inspection-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<InspectionEvidenceImage inspectionId="inspection-1" evidenceId="evidence-2" alt="Detalle del hallazgo" className="aspect-[4/3]" preview />);

    const thumbnail = await screen.findByAltText('Detalle del hallazgo');
    fireEvent.load(thumbnail);
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar evidencia: Detalle del hallazgo' }));
    expect(screen.getByRole('dialog', { name: 'Vista ampliada: Detalle del hallazgo' })).toBeInTheDocument();
    expect(screen.getAllByAltText('Detalle del hallazgo')).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Vista ampliada: Detalle del hallazgo' })).not.toBeInTheDocument();
  });
});
