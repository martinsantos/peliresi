import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CalculadoraTEF from '../../components/CalculadoraTEF';
import { StepTEF, type StepTEFHandle } from '../../pages/public/inscripcion/steps/StepTEF';
import { A_LABELS, A_OPTIONS, DEFAULT_A } from '../../utils/calculoTEF';

describe('CalculadoraTEF reports every declared input to its parent', () => {
  it('opens contextual help without changing a coefficient and exposes its expanded state', () => {
    const onInputsChange=vi.fn();
    render(<CalculadoraTEF corrientesY={['Y8']} tieneISO={false} onInputsChange={onInputsChange} />);
    const help=screen.getByRole('button',{name:'Ayuda sobre '+A_LABELS.a1_stock});
    expect(help).toHaveAttribute('aria-expanded','false');
    const count=onInputsChange.mock.calls.length;
    fireEvent.click(help);
    expect(help).toHaveAttribute('aria-expanded','true');
    expect(document.getElementById(help.getAttribute('aria-controls')!)).toBeVisible();
    expect(onInputsChange).toHaveBeenCalledTimes(count);
    fireEvent.click(help);
    expect(help).toHaveAttribute('aria-expanded','false');
    expect(document.getElementById(help.getAttribute('aria-controls')!)).not.toBeVisible();
  });
  it('keeps an A coefficient choice when the step is left and remounted', () => {
    const onInputsChange = vi.fn();
    const choice = A_OPTIONS.a1_stock.find(option => option.valor !== DEFAULT_A.a1_stock)!.valor;
    render(<CalculadoraTEF corrientesY={['Y8']} tieneISO={false} onInputsChange={onInputsChange} />);
    fireEvent.change(screen.getByLabelText(A_LABELS.a1_stock), { target: { value: String(choice) } });
    expect(onInputsChange).toHaveBeenLastCalledWith(expect.objectContaining({ coefA: expect.objectContaining({ a1_stock: choice }) }));
  });
});


describe('Unreconciled TEF never emits a fiscal result', () => {
  it.each([{ inline: true, tieneISO: true }, { inline: true, tieneISO: false }, { inline: false, tieneISO: true }, { inline: false, tieneISO: false }])('keeps declarations without exposing an invalid amount: %j', ({ inline, tieneISO }) => {
    const ref = React.createRef<import('../../components/CalculadoraTEF').CalculadoraTEFHandle>();
    const initialInputs = { zona: 'zona_industrial', coefA: DEFAULT_A, personal: 10, potenciaHP: 20, superficieM2: 30 };
    render(<CalculadoraTEF ref={ref} inline={inline} tieneISO={tieneISO} corrientesY={['Y8']} initialInputs={initialInputs} />);
    const result = screen.getByRole('region', { name: 'Estado de la evaluación TEF' });
    expect(result).toHaveTextContent('Importe pendiente de liquidación');
    expect(result).toHaveTextContent('El cálculo está en revisión');
    expect(screen.queryByText(/TEF =|R =|Factor usado|\$ /)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Consultar normativa en ATM/ })).toHaveAttribute('href', 'https://atm.mendoza.gov.ar/normativas/ley-impositiva/');
    expect(screen.queryByText(/incentivo|fijado por la Autoridad|Paso [35]/i)).not.toBeInTheDocument();
    expect(ref.current).not.toHaveProperty('getResult');
    expect(ref.current?.getInputs()).toEqual(initialInputs);
  });
});


it('the legacy public step snapshots declarations without inventing R or a monetary result', () => {
  const ref = React.createRef<StepTEFHandle>();
  render(<StepTEF ref={ref} form={{corrientesControl:'Y8',certificacionISO:'2026-01-01'}} isGenerador isOperador={false} />);
  fireEvent.change(screen.getByLabelText('Cantidad de Personal'), {target:{value:'32'}});
  const snapshot = ref.current!.snapshotTEF();
  expect(snapshot.tefPersonal).toBe('32');
  expect(JSON.parse(snapshot.tefInputs).personal).toBe(32);
  expect(snapshot).not.toHaveProperty('factorR');
  expect(snapshot).not.toHaveProperty('montoMxR');
});
