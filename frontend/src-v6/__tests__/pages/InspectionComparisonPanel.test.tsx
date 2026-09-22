import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { InspectionComparisonPanel } from '../../pages/inspecciones/InspectionComparisonPanel';

describe('InspectionComparisonPanel', () => {
  it('presents declared and field values and records a discrepancy', () => {
    const onChange = vi.fn();
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={onChange} onEvidence={vi.fn()} comparisons={[{
      id: 'comparison-1', codigo: 'REG-HABILITACION', categoria: 'Habilitación', etiqueta: 'Número de habilitación',
      origen: 'transportista.numeroHabilitacion', valorDeclarado: 'T-000005', valorObservado: 'T-000008',
      resultado: 'PENDIENTE', observacion: null, orden: 10, evidencias: [],
    }]} /></MemoryRouter>);

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

    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={onChange} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);

    expect(screen.getByRole('button', { name: /Residuos\s*0\/3/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Corriente Y4')).toBeInTheDocument();
    expect(screen.getByText('Corriente Y8')).toBeInTheDocument();
    expect(screen.getByText('Corriente Y48')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Coincide' })[1]).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getAllByRole('button', { name: 'Coincide' })[1]);
    expect(onChange).toHaveBeenCalledWith('comparison-Y8', { resultado: 'COINCIDE' });
  });

  it('opens the exact declared value from its anchor and navigates across pending categories', () => {
    function Hash() { return <output data-testid="hash">{useLocation().hash}</output>; }
    const comparisons = ['Identidad', 'Actividad'].map((categoria, index) => ({
      id: `comparison-${index}`, codigo: `ACT-${index}`, categoria, etiqueta: `Dato ${index}`,
      origen: 'actor', valorDeclarado: 'Declarado', valorObservado: null,
      resultado: 'PENDIENTE' as const, observacion: null, orden: index, evidencias: [],
    }));
    render(<MemoryRouter initialEntries={['/inspecciones/qa#declaracion/ACT-1']}><Hash /><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: 'Valor verificado: Dato 1' })).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Valor verificado: Dato 0' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente dato pendiente' }));
    expect(screen.getByTestId('hash')).toHaveTextContent('#declaracion/ACT-0');
    expect(screen.getByRole('textbox', { name: 'Valor verificado: Dato 0' })).toBeVisible();
  });
});
