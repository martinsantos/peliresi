import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InspectionComparisonPanel } from '../../pages/inspecciones/InspectionComparisonPanel';

describe('InspectionComparisonPanel', () => {
  it('presents declared and field values and records a discrepancy', () => {
    const onChange = vi.fn();
    render(<InspectionComparisonPanel inspectionId="inspection-1" editable onChange={onChange} onEvidence={vi.fn()} comparisons={[{
      id: 'comparison-1', codigo: 'REG-HABILITACION', categoria: 'Habilitación', etiqueta: 'Número de habilitación',
      origen: 'transportista.numeroHabilitacion', valorDeclarado: 'T-000005', valorObservado: 'T-000008',
      resultado: 'PENDIENTE', observacion: null, orden: 10, evidencias: [],
    }]} />);

    expect(screen.getByText('Declarado vs. verificado')).toBeInTheDocument();
    expect(screen.getByText('T-000005')).toBeInTheDocument();
    expect(screen.getByDisplayValue('T-000008')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Difiere' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Difiere' }));
    expect(onChange).toHaveBeenCalledWith('comparison-1', { resultado: 'DIFIERE' });
  });

  it('renders each Y stream as an independent field decision', () => {
    const onChange = vi.fn();
    const comparisons = ['Y4', 'Y8', 'Y48'].map((stream, index) => ({
      id: `comparison-${stream}`, codigo: `RES-${stream}`, categoria: 'Residuos', etiqueta: `Corriente ${stream}`,
      origen: `transportista.corrientesAutorizadas:${stream}`, valorDeclarado: stream, valorObservado: null,
      resultado: 'PENDIENTE' as const, observacion: null, orden: 80 + index, evidencias: [],
    }));

    render(<InspectionComparisonPanel inspectionId="inspection-1" editable onChange={onChange} onEvidence={vi.fn()} comparisons={comparisons} />);

    expect(screen.getByRole('button', { name: /Residuos\s*0\/3/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Corriente Y4')).toBeInTheDocument();
    expect(screen.getByText('Corriente Y8')).toBeInTheDocument();
    expect(screen.getByText('Corriente Y48')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Coincide' })[1]).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getAllByRole('button', { name: 'Coincide' })[1]);
    expect(onChange).toHaveBeenCalledWith('comparison-Y8', { resultado: 'COINCIDE' });
  });
});
