import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepDocumentos } from '../../pages/public/inscripcion/steps/StepDocumentos';

function props(tipo: string): ComponentProps<typeof StepDocumentos> {
  return { docs:[{tipo,nombre:'Documento QA',required:false}],adjuntos:{},uploadedDocs:{[tipo]:{id:'doc',solicitudId:'alta',tipo,nombre:'qa.pdf',path:'qa.pdf',mimeType:'application/pdf',size:100,estado:'PENDIENTE',createdAt:'2026-10-25'}},uploadStates:{},uploadErrors:{},requirementsStatus:'loaded',maxBytes:10485760,onRetryRequirements:vi.fn(),onAddFile:vi.fn(),onRemoveFile:vi.fn(),onRetryReading:vi.fn() };
}

describe('reading the original in an application', () => {
  it('identifies an optional electricity bill and explains what happens if it is attached', () => {
    const data = props('FACTURA_ELECTRICA'); data.uploadedDocs = {};
    render(<StepDocumentos {...data} />);
    const row = screen.getByTestId('registration-document-FACTURA_ELECTRICA');
    expect(row).toHaveTextContent('Opcional');
    expect(row).toHaveTextContent('Si elegís adjuntarla');
    expect(row).not.toHaveTextContent('obligatorio');
  });
  it('keeps the optional label alongside the saved document review state', () => {
    render(<StepDocumentos {...props('FACTURA_ELECTRICA')} />);
    const row = screen.getByTestId('registration-document-FACTURA_ELECTRICA');
    expect(row).toHaveTextContent('Opcional');
    expect(row).toHaveTextContent('Guardado · Pendiente de revisión');
  });
  it('respects the requirement returned by the server if it changes in the future', () => {
    const data = props('FACTURA_ELECTRICA'); data.uploadedDocs = {}; data.docs[0].required = true;
    render(<StepDocumentos {...data} />);
    const row = screen.getByTestId('registration-document-FACTURA_ELECTRICA');
    expect(row).not.toHaveTextContent('Opcional');
    expect(row.querySelector('[aria-label="obligatorio"]')).toBeInTheDocument();
    expect(row).toHaveTextContent('Adjuntá la factura');
  });
  it.each(['COMPROBANTE_PAGO','FACTURA_ELECTRICA','LICENCIA_CHOFER_QA'])('reads supported saved %s without replacing it', tipo => {
    const data=props(tipo); render(<StepDocumentos {...data} />);
    fireEvent.click(screen.getByRole('button',{name:'Leer documento',exact:true}));
    expect(data.onRetryReading).toHaveBeenCalledWith(tipo);
    expect(data.onAddFile).not.toHaveBeenCalled(); expect(data.onRemoveFile).not.toHaveBeenCalled();
  });
  it('does not read a superseded original while its replacement is pending', () => {
    const data=props('FACTURA_ELECTRICA');data.adjuntos.FACTURA_ELECTRICA=new File(['qa'],'reemplazo.pdf',{type:'application/pdf'});
    render(<StepDocumentos {...data} />);
    expect(screen.getByText('reemplazo.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Leer documento',exact:true})).toBeNull();
    expect(screen.queryByText(/El original sigue guardado/)).toBeNull();
  });
  it('does not offer an unsupported document to the reading endpoint', () => {
    render(<StepDocumentos {...props('CONSTANCIA_AFIP')} />);
    expect(screen.queryByRole('button',{name:'Leer documento',exact:true})).toBeNull();
  });
  it('keeps trial selection explicit instead of claiming the file is stored', () => {
    const data=props('FACTURA_ELECTRICA');data.uploadedDocs={};data.reviewMode=true;data.adjuntos.FACTURA_ELECTRICA=new File(['qa'],'prueba.pdf');
    render(<StepDocumentos {...data} />);
    expect(screen.getByText(/todavía no está guardado en el servidor/)).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Leer documento',exact:true}));
    expect(data.onRetryReading).toHaveBeenCalledWith('FACTURA_ELECTRICA');
  });
});


describe('document storage and administrative review are separate', () => {
  it.each(['COMPROBANTE_PAGO', 'FACTURA_ELECTRICA', 'CONSTANCIA_AFIP'])('%s names pending review even when the file is saved', tipo => {
    render(<StepDocumentos {...props(tipo)} />);
    const row = screen.getByTestId(`registration-document-${tipo}`);
    expect(row).toHaveTextContent('Guardado · Pendiente de revisión');
    expect(row).not.toHaveClass('bg-emerald-50/60');
    expect(row.querySelector('.lucide-circle-check-big')).toBeNull();
  });
  it('only an explicit administrative decision presents a document as approved', () => {
    const data = props('FACTURA_ELECTRICA'); data.uploadedDocs.FACTURA_ELECTRICA.estado = 'APROBADO';
    render(<StepDocumentos {...data} />);
    expect(screen.getByTestId('registration-document-FACTURA_ELECTRICA')).toHaveTextContent('Guardado · Documento aprobado');
  });
  it('names a rejected document and keeps the correction reason visible', () => {
    const data = props('COMPROBANTE_PAGO');
    Object.assign(data.uploadedDocs.COMPROBANTE_PAGO, { estado: 'RECHAZADO', observaciones: 'El CUIT no corresponde a este establecimiento.' });
    render(<StepDocumentos {...data} />);
    expect(screen.getByTestId('registration-document-COMPROBANTE_PAGO')).toHaveTextContent('Guardado · Documento rechazado');
    expect(screen.getByRole('alert')).toHaveTextContent('El CUIT no corresponde');
  });
  it('does not transfer approval from the saved original to a pending replacement', () => {
    const data = props('FACTURA_ELECTRICA'); data.uploadedDocs.FACTURA_ELECTRICA.estado = 'APROBADO';
    data.adjuntos.FACTURA_ELECTRICA = new File(['replacement'], 'nueva.pdf');
    render(<StepDocumentos {...data} />);
    const row = screen.getByTestId('registration-document-FACTURA_ELECTRICA');
    expect(row).not.toHaveClass('bg-emerald-50/60');
    expect(row).toHaveTextContent('Reemplazo pendiente');
    expect(row).not.toHaveTextContent('Documento aprobado');
  });
});
