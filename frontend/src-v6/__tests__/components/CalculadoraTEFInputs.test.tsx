import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CalculadoraTEF from '../../components/CalculadoraTEF';
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
