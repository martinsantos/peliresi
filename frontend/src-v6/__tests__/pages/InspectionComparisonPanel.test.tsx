import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getAllByText('T-000005')).toHaveLength(2);
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

  it('advances through the same grouped order shown in the form, even when source rows are interleaved', () => {
    function Hash() { return <output data-testid="hash">{useLocation().hash}</output>; }
    const comparisons = [
      { codigo: 'A-01', categoria: 'Documentación', etiqueta: 'Primer documento' },
      { codigo: 'B-01', categoria: 'Actividad', etiqueta: 'Actividad declarada' },
      { codigo: 'A-02', categoria: 'Documentación', etiqueta: 'Segundo documento' },
    ].map((row, index) => ({ ...row, id: `comparison-${index}`, origen: 'actor', valorDeclarado: 'Declarado', valorObservado: null, resultado: 'PENDIENTE' as const, observacion: null, orden: index, evidencias: [] }));
    render(<MemoryRouter initialEntries={['/inspecciones/qa#declaracion/A-01']}><Hash /><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);
    const first = document.querySelector('[data-inspection-anchor="declaracion/A-01"]')!;
    expect(first).toHaveTextContent('1/3');
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: 'Siguiente dato pendiente' }));
    expect(screen.getByTestId('hash')).toHaveTextContent('#declaracion/A-02');
    expect(screen.getByRole('textbox', { name: 'Valor verificado: Segundo documento' })).toBeVisible();
  });

  it('keeps long authorized treatments condensed until the inspector asks for detail', () => {
    const comparisons = [
      { id: 'first', codigo: 'ACT-TECNOLOGIA', categoria: 'Operación', etiqueta: 'Tecnología declarada', origen: 'operador.tecnologia', valorDeclarado: 'Tecnología A', valorObservado: null, resultado: 'PENDIENTE' as const, observacion: null, orden: 10, evidencias: [] },
      { id: 'treatments', codigo: 'ACT-TRATAMIENTOS', categoria: 'Operación', etiqueta: 'Tratamientos autorizados', origen: 'operador.tratamientos', valorDeclarado: 'Y8 · Acopio y almacenamiento temporal de residuos peligrosos\nY9 · Lavado de envases y piezas metálicas\nY11 · Filtrado y separación física', valorObservado: null, resultado: 'PENDIENTE' as const, observacion: null, orden: 20, evidencias: [] },
    ];
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);
    const row = document.querySelector('[data-inspection-anchor="declaracion/ACT-TRATAMIENTOS"]') as HTMLElement;
    expect(row).toHaveTextContent('3 tratamientos declarados · Y8, Y9, Y11');
    expect(within(row).queryByText('Acopio y almacenamiento temporal de residuos peligrosos')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Agregar detalle' }));
    expect(within(row).getByText('Acopio y almacenamiento temporal de residuos peligrosos')).toBeVisible();
    expect(within(row).getByRole('textbox', { name: 'Valor verificado: Tratamientos autorizados' })).toBeVisible();
  });

  it('groups identical treatment descriptions without combining their Y decisions', () => {
    const comparisons = [
      { id: 'technology', codigo: 'ACT-TECNOLOGIA', categoria: 'Operación', etiqueta: 'Tecnología declarada', origen: 'operador.tecnologia', valorDeclarado: 'Tecnología A', valorObservado: null, resultado: 'PENDIENTE' as const, observacion: null, orden: 10, evidencias: [] },
      { id: 'treatments', codigo: 'ACT-TRATAMIENTOS', categoria: 'Operación', etiqueta: 'Tratamientos autorizados', origen: 'operador.tratamientos', valorDeclarado: 'Y8 · Acopio autorizado\nY9 · Acopio autorizado\nY11 · Filtrado autorizado', valorObservado: null, resultado: 'PENDIENTE' as const, observacion: null, orden: 20, evidencias: [] },
    ];
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);
    const row = document.querySelector('[data-inspection-anchor="declaracion/ACT-TRATAMIENTOS"]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Agregar detalle' }));
    expect(within(row).getAllByText('Acopio autorizado')).toHaveLength(1);
    expect(within(row).getByText('Y8')).toBeVisible();
    expect(within(row).getByText('Y9')).toBeVisible();
    expect(within(row).getByText('Filtrado autorizado')).toBeVisible();
  });
});
