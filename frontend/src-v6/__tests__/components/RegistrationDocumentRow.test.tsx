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
  it('marks a rejected document as rejected and offers replacement rather than pretending it passed review', () => {
    const handlers = props(); handlers.uploadedDocs[doc.tipo] = { ...doc, estado: 'RECHAZADO', observaciones: 'QA archivo ilegible' };
    render(<StepDocumentos {...handlers} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Documento rechazado: QA archivo ilegible');
    expect(screen.getByRole('button', { name: 'Reemplazar Comprobante de sellado / pago' })).toBeEnabled();
    expect(screen.getByTestId(`registration-document-${doc.tipo}`)).toHaveClass('border-error-200');
  });
  it('does not label the selected replacement as already saved or reuse the original OCR under its new name', () => {
    const pending = new File(['QA'], 'nuevo-pendiente.pdf', { type: 'application/pdf' });
    render(<StepDocumentos {...props()} adjuntos={{ [doc.tipo]: pending }} uploadStates={{ [doc.tipo]: 'error' }} />);
    expect(screen.getByText(/KB · Pendiente/)).toBeVisible();
    expect(screen.getByText(/El original.*sigue guardado/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Descartar selección pendiente de Comprobante de sellado / pago' })).toBeEnabled();
  });
});
