import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CalculadoraTEF from '../../components/CalculadoraTEF';
import { A_LABELS, A_OPTIONS, DEFAULT_A, calcularTEF } from '../../utils/calculoTEF';

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


describe('TEF simulation does not claim an official amount or a context-specific step', () => {
  it.each([{ inline: true, tieneISO: true }, { inline: true, tieneISO: false }, { inline: false, tieneISO: true }, { inline: false, tieneISO: false }])('identifies the simulation beside its amount: %j', ({ inline, tieneISO }) => {
    const ref = React.createRef<import('../../components/CalculadoraTEF').CalculadoraTEFHandle>();
    const initialInputs = { zona: 'zona_industrial', coefA: DEFAULT_A, personal: 10, potenciaHP: 20, superficieM2: 30 };
    render(<CalculadoraTEF ref={ref} inline={inline} tieneISO={tieneISO} corrientesY={['Y8']} initialInputs={initialInputs} />);
    const result = screen.getByRole('region', { name: 'Resultado de simulación TEF' });
    expect(result).toHaveTextContent('No es una liquidación');
    expect(result).toHaveTextContent('Fórmula y parámetros pendientes de verificación normativa');
    expect(screen.queryByText(/incentivo|fijado por la Autoridad|Paso [35]/i)).not.toBeInTheDocument();
    expect(ref.current?.getResult()).toEqual(calcularTEF({ zona: initialInputs.zona, coeficientesA: DEFAULT_A, personal: 10, potenciaHP: 20, superficieM2: 30, corrientesY: ['Y8'], tieneISO }));
    expect(ref.current?.getInputs()).toEqual(initialInputs);
  });
});
