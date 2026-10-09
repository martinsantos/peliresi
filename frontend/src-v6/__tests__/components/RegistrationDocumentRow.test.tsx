import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepDocumentos } from '../../pages/public/inscripcion/steps/StepDocumentos';
import type { DocumentoSolicitud } from '../../types/api';

const doc = { id: 'qa', tipo: 'COMPROBANTE_PAGO', nombre: 'Un nombre de recibo muy largo que no debe ocultar su estado.pdf', size: 3072, estado: 'PENDIENTE' } as DocumentoSolicitud;
const props = () => ({ docs: [{ tipo: doc.tipo, nombre: 'Comprobante de sellado / pago', required: false }], adjuntos: {}, uploadedDocs: { [doc.tipo]: doc }, uploadStates: {}, uploadErrors: {}, requirementsStatus: 'loaded' as const, maxBytes: 10 * 1024 * 1024, onRetryRequirements: vi.fn(), onAddFile: vi.fn(), onRemoveFile: vi.fn(), onDownloadFile: vi.fn() });
describe('saved registration receipts remain identifiable and inspectable on phones', () => {
  it('does not truncate the server acknowledgment together with a long filename', () => {
    render(<StepDocumentos {...props()} />);
    expect(screen.getByText(/3 KB.*Guardado/)).not.toHaveClass('truncate');
  });
  it('can download the stored original without a destructive delete or reupload', () => {
    const handlers = props(); render(<StepDocumentos {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: `Descargar ${doc.nombre}`, exact: true }));
    expect(handlers.onDownloadFile).toHaveBeenCalledWith(doc.tipo);
    expect(handlers.onRemoveFile).not.toHaveBeenCalled(); expect(handlers.onAddFile).not.toHaveBeenCalled();
  });
});
