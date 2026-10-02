import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DocumentUpload from '../../components/DocumentUpload';
import type { Documento } from '../../services/generador-fiscal.service';

const doc = { id: 'qa-doc', nombre: 'Memoria técnica QA.pdf', tipo: 'MEMORIA_TECNICA', anio: 2026, size: 2048, estado: 'PENDIENTE' } as Documento;
const props = () => ({ documentos: [doc], isAdmin: true, onUpload: vi.fn(), onDownload: vi.fn(), onRevisar: vi.fn(), onDelete: vi.fn() });

describe('document rows preserve identity and actions on a narrow screen', () => {
  it('gives the filename its own flexible column, with status/actions on a separate mobile row', () => {
    render(<DocumentUpload {...props()} />);
    const identity = screen.getByText(doc.nombre).parentElement!;
    expect(identity).toHaveClass('min-w-0');
    expect(identity.parentElement).toHaveClass('grid', 'grid-cols-[18px_minmax(0,1fr)]', 'sm:flex');
    expect(screen.getByTitle('Descargar').parentElement?.parentElement).toHaveClass('col-span-2', 'flex-wrap', 'sm:contents');
  });

  it('identifies every action by its document and provides 44px touch targets', () => {
    render(<DocumentUpload {...props()} />);
    for (const action of ['Descargar', 'Aprobar', 'Rechazar', 'Eliminar']) {
      const button = screen.getByRole('button', { name: `${action} ${doc.nombre}`, exact: true });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('min-h-11', 'min-w-11');
    }
  });

  it('downloads and reviews only the selected document', () => {
    const handlers = props();
    render(<DocumentUpload {...handlers} />);
    fireEvent.click(screen.getByTitle('Descargar'));
    fireEvent.click(screen.getByTitle('Aprobar'));
    fireEvent.click(screen.getByTitle('Rechazar'));
    fireEvent.click(screen.getByTitle('Eliminar'));
    expect(handlers.onDownload).toHaveBeenCalledWith(doc);
    expect(handlers.onRevisar.mock.calls).toEqual([[doc.id, 'APROBADO'], [doc.id, 'RECHAZADO']]);
    expect(handlers.onDelete).toHaveBeenCalledWith(doc.id);
    expect(handlers.onUpload).not.toHaveBeenCalled();
  });

  it('keeps downloads in read-only mode without exposing upload or mutation actions', () => {
    const handlers = props();
    render(<DocumentUpload {...handlers} readOnly />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByTitle('Descargar'));
    expect(handlers.onDownload).toHaveBeenCalledWith(doc);
    expect(screen.queryByTitle('Aprobar')).toBeNull();
    expect(screen.queryByTitle('Rechazar')).toBeNull();
    expect(screen.queryByTitle('Eliminar')).toBeNull();
    expect(handlers.onRevisar).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });
});
