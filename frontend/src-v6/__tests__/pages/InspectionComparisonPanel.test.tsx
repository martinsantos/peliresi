import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { InspectionComparisonPanel } from '../../pages/inspecciones/InspectionComparisonPanel';

describe('InspectionComparisonPanel', () => {
  it('offers declared data before search focus and keeps explicit search and deep-link closure usable', () => {
    const comparisons = ['Documentos', 'Residuos'].map((categoria, index) => ({ id: `row-${index}`, codigo: `QA-${index}`, categoria, etiqueta: `Dato ${index}`, origen: 'actor', valorDeclarado: 'Declarado', valorObservado: 'Observado', resultado: 'DIFIERE' as const, observacion: 'Hallazgo', orden: index, evidencias: [] }));
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="qa" comparisons={comparisons} editable onChange={vi.fn()} onEvidence={vi.fn()} /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: /^Ir a un dato declarado:/ });
    trigger.focus();
    fireEvent.click(trigger);
    const search = screen.getByRole('searchbox', { name: 'Buscar dato declarado' });
    expect(search).not.toHaveFocus();
    const index = screen.getByRole('navigation', { name: 'Datos declarados' });
    expect(within(index).getAllByRole('button')).toHaveLength(2);
    search.focus();
    fireEvent.change(search, { target: { value: 'Residuos' } });
    expect(within(index).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(index).getByRole('button', { name: /Dato 1/ }));
    expect(screen.getByRole('textbox', { name: 'Valor verificado: Dato 1' })).toHaveValue('Observado');
    const group = screen.getByRole('button', { name: /^Residuos\s*1\/1/ });
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: 'Valor verificado: Dato 1' })).toBeNull();
    fireEvent.click(group);
    expect(document.getElementById('comparison-row-1')).toHaveAttribute('data-result', 'DIFIERE');
    fireEvent.click(within(document.getElementById('comparison-row-1')!).getByRole('button', { name: 'Ver o corregir detalle' }));
    expect(screen.getByRole('textbox', { name: 'Valor verificado: Dato 1' })).toHaveValue('Observado');
  });
  it('opens groups independently and really collapses the selected group without losing decisions', () => {
    const comparisons = ['Documentos', 'Residuos'].map((categoria, index) => ({ id: `row-${index}`, codigo: `QA-${index}`, categoria, etiqueta: `Dato ${index}`, origen: 'actor', valorDeclarado: 'Declarado', valorObservado: 'Observado', resultado: 'DIFIERE' as const, observacion: 'Hallazgo', orden: index, evidencias: [] }));
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="qa" comparisons={comparisons} editable onChange={vi.fn()} onEvidence={vi.fn()} /></MemoryRouter>);
    const documents = screen.getByRole('button', { name: /^Documentos\s*1\/1/ });
    const wastes = screen.getByRole('button', { name: /^Residuos\s*1\/1/ });
    fireEvent.click(wastes);
    expect(documents).toHaveAttribute('aria-expanded', 'true');
    expect(wastes).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Dato 0')).toBeVisible();
    fireEvent.click(wastes);
    expect(wastes).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Dato 1')).toBeNull();
    fireEvent.click(wastes);
    expect(document.getElementById('comparison-row-1')).toHaveAttribute('data-result', 'DIFIERE');
  });
  it('presents declared and field values and records a discrepancy', () => {
    const onChange = vi.fn();
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={onChange} onEvidence={vi.fn()} comparisons={[{
      id: 'comparison-1', codigo: 'REG-HABILITACION', categoria: 'Habilitación', etiqueta: 'Número de habilitación',
      origen: 'transportista.numeroHabilitacion', valorDeclarado: 'T-000005', valorObservado: 'T-000008',
      resultado: 'PENDIENTE', observacion: null, orden: 10, evidencias: [],
    }]} /></MemoryRouter>);

    expect(screen.getByText('Lo informado y lo encontrado')).toBeInTheDocument();
    expect(screen.getByText('En campo, ¿coincide?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle y evidencia' }));
    expect(screen.getAllByText('T-000005')).toHaveLength(1);
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
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente pendiente' }));
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
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: 'Siguiente pendiente' }));
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
    fireEvent.click(within(row).getByRole('button', { name: 'Anotar lo encontrado' }));
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
    fireEvent.click(within(row).getByRole('button', { name: 'Anotar lo encontrado' }));
    expect(within(row).getAllByText('Acopio autorizado')).toHaveLength(1);
    expect(within(row).getByText('Y8')).toBeVisible();
    expect(within(row).getByText('Y9')).toBeVisible();
    expect(within(row).getByText('Filtrado autorizado')).toBeVisible();
  });

  it('summarizes a long treatment declaration before revealing all 22 details', () => {
    const values = Array.from({ length: 22 }, (_, index) => `Y${index + 1} · Tratamiento ${index + 1}`);
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={[{
      id: 'treatments', codigo: 'ACT-TRATAMIENTOS', categoria: 'Operación', etiqueta: 'Tratamientos autorizados',
      origen: 'operador.tratamientos', valorDeclarado: values.join('\n'), valorObservado: null,
      resultado: 'PENDIENTE', observacion: null, orden: 1, evidencias: [],
    }]} /></MemoryRouter>);
    const row = document.querySelector('[data-inspection-anchor="declaracion/ACT-TRATAMIENTOS"]') as HTMLElement;
    expect(row).toHaveTextContent('22 tratamientos declarados · Y1, Y2, Y3 y 19 más');
    expect(row).not.toHaveTextContent('Tratamiento 22');
    fireEvent.click(within(row).getByRole('button', { name: 'Anotar lo encontrado' }));
    expect(row).toHaveTextContent('Tratamiento 22');
  });

  it('asks for the reason instead of an observed value when a field could not be verified', () => {
    render(<MemoryRouter initialEntries={['/inspecciones/qa#declaracion/RES-Y12']}><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={[{
      id: 'stream', codigo: 'RES-Y12', categoria: 'Residuos', etiqueta: 'Corriente Y12',
      origen: 'operador.corrientes', valorDeclarado: 'Y12', valorObservado: null,
      resultado: 'NO_VERIFICADO', observacion: null, orden: 1, evidencias: [],
    }]} /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: 'Motivo de no verificación: Corriente Y12' })).toHaveAttribute('placeholder', 'Contá por qué no pudiste verificarlo');
  });

  it('shows long current lists in six-item blocks and opens an indexed current in its block', () => {
    const comparisons = Array.from({ length: 13 }, (_, index) => ({
      id: `current-${index + 1}`, codigo: `RES-Y${index + 1}`, categoria: 'Residuos', etiqueta: `Corriente Y${index + 1}`,
      origen: 'generador.corrientesControl', valorDeclarado: `Y${index + 1}`, valorObservado: null,
      resultado: 'PENDIENTE' as const, observacion: null, orden: index, evidencias: [],
    }));
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={vi.fn()} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);

    expect(screen.getByText('Mostrando 1–6 de 13')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-inspection-anchor^="declaracion/RES-Y"]')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente bloque' }));
    expect(screen.getByText('Mostrando 7–12 de 13')).toBeInTheDocument();
    expect(document.querySelector('[data-inspection-anchor="declaracion/RES-Y1"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a un dato declarado: Buscar dato' }));
    fireEvent.click(screen.getByRole('button', { name: /Corriente Y13/ }));
    expect(screen.getByText('Mostrando 13–13 de 13')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Valor verificado: Corriente Y13' })).toBeVisible();
  });

  it('previews the exact visible pending currents before applying a batch result', () => {
    const onChange = vi.fn();
    const comparisons = Array.from({ length: 8 }, (_, index) => ({
      id: `current-${index + 1}`, codigo: `RES-Y${index + 1}`, categoria: 'Residuos', etiqueta: `Corriente Y${index + 1}`,
      origen: 'operador.corrientesY', valorDeclarado: `Y${index + 1}`, valorObservado: null,
      resultado: index === 0 ? 'DIFIERE' as const : 'PENDIENTE' as const,
      observacion: index === 0 ? 'Diferencia verificada' : null, orden: index, evidencias: [],
    }));
    render(<MemoryRouter><InspectionComparisonPanel inspectionId="inspection-1" editable onChange={onChange} onEvidence={vi.fn()} comparisons={comparisons} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Selección múltiple' }));
    fireEvent.click(screen.getByLabelText('Seleccionar pendientes de este bloque'));
    expect(screen.getByText('5 seleccionados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar coincidencias' }));
    expect(screen.getByRole('heading', { name: 'Confirmar 5 coincidencias' })).toBeInTheDocument();
    expect(screen.getByText('Corriente Y2 · RES-Y2')).toBeInTheDocument();
    expect(screen.queryByText('Corriente Y7 · RES-Y7')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar a 5 datos' }));
    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange).not.toHaveBeenCalledWith('current-1', expect.anything());
    expect(onChange).not.toHaveBeenCalledWith('current-7', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente bloque' }));
    expect(screen.getByText('0 seleccionados')).toBeInTheDocument();
  });
});
