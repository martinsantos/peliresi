import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepActividad } from '../../pages/public/inscripcion/steps/StepActividad';
import { StepResumen } from '../../pages/public/inscripcion/steps/StepResumen';
import { getReviewFixture } from '../../pages/public/inscripcion/shared';

describe('registration keeps information readable without repeating instructions', () => {
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as const)('%s shows full review values, including long addresses, without ellipses', tipoActor => {
    const fixture = getReviewFixture(tipoActor);
    fixture.form.razonSocial = 'Cooperativa de tratamiento y transporte de residuos del departamento de prueba';
    fixture.form.domicilio = 'Ruta Provincial de prueba kilómetro 123, acceso lateral, establecimiento 45';
    render(<StepResumen {...fixture} adjuntos={{}} uploadedDocs={{}} tipoActor={tipoActor}
      isGenerador={tipoActor === 'GENERADOR'} isOperador={tipoActor === 'OPERADOR'} isTransportista={tipoActor === 'TRANSPORTISTA'} regError={null} />);
    for (const value of [fixture.form.razonSocial, fixture.form.domicilio]) {
      const cell = screen.getByText(value, { exact: true });
      expect(cell.tagName).toBe('DD');
      expect(cell).not.toHaveClass('truncate');
      expect(cell).toHaveClass('[overflow-wrap:anywhere]');
    }
  });

  it.each([false, true])('keeps units in the field label once, and editing unchanged (operator=%s)', isOperador => {
    const up = vi.fn();
    render(<StepActividad form={{ tefPersonal: '4', tefPotencia: '120', tefSuperficie: '800' }} up={up} isOperador={isOperador} />);
    expect(screen.getByLabelText('Potencia instalada (HP)')).toHaveValue(120);
    expect(screen.getByLabelText('Superficie cubierta (m²)')).toHaveValue(800);
    expect(screen.queryByText('HP', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('m²', { exact: true })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Potencia instalada (HP)'), { target: { value: '121' } });
    expect(up).toHaveBeenCalledWith('tefPotencia', '121');
    expect(screen.queryByText(/Declarás los datos de tu establecimiento/)).not.toBeInTheDocument();
  });
});


describe('registration summary preserves document review and pending replacements', () => {
  const original = { id:'doc', solicitudId:'alta', tipo:'FACTURA_ELECTRICA', nombre:'original.pdf', path:'qa.pdf', mimeType:'application/pdf', size:1024, estado:'APROBADO' as const, createdAt:'2026-10-26' };
  const renderSummary = (estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO', replacement = false) => render(<StepResumen {...getReviewFixture('GENERADOR')} tipoActor="GENERADOR" isGenerador isOperador={false} isTransportista={false} regError={null} uploadedDocs={{ FACTURA_ELECTRICA: { ...original, estado } }} adjuntos={replacement ? { FACTURA_ELECTRICA: new File(['new'], 'reemplazo.pdf') } : {}} />);
  it.each([['PENDIENTE','Pendiente de revisión'], ['APROBADO','Documento aprobado'], ['RECHAZADO','Documento rechazado']] as const)('shows administrative state %s separately from storage', (state, label) => {
    renderSummary(state);
    expect(screen.getByText(new RegExp(`original.pdf.*Guardado.*${label}`))).toBeInTheDocument();
  });
  it('shows the pending replacement rather than claiming only the original is ready', () => {
    renderSummary('APROBADO', true);
    expect(screen.getByText(/reemplazo.pdf.*Reemplazo pendiente/)).toBeInTheDocument();
    expect(screen.getByText(/original.pdf.*sigue guardado/)).toBeInTheDocument();
  });
});
