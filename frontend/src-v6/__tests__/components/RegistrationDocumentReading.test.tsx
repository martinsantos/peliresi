import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepDocumentos } from '../../pages/public/inscripcion/steps/StepDocumentos';

function props(tipo: string): ComponentProps<typeof StepDocumentos> {
  return { docs:[{tipo,nombre:'Documento QA',required:false}],adjuntos:{},uploadedDocs:{[tipo]:{id:'doc',solicitudId:'alta',tipo,nombre:'qa.pdf',path:'qa.pdf',mimeType:'application/pdf',size:100,estado:'PENDIENTE',createdAt:'2026-10-25'}},uploadStates:{},uploadErrors:{},requirementsStatus:'loaded',maxBytes:10485760,onRetryRequirements:vi.fn(),onAddFile:vi.fn(),onRemoveFile:vi.fn(),onRetryReading:vi.fn() };
}

describe('reading the original in an application', () => {
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
    expect(screen.getByRole('status')).toHaveTextContent('todavía no está guardado en el servidor');
    fireEvent.click(screen.getByRole('button',{name:'Leer documento',exact:true}));
    expect(data.onRetryReading).toHaveBeenCalledWith('FACTURA_ELECTRICA');
  });
});
