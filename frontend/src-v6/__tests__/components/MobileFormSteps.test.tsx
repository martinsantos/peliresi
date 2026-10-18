import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileFormSteps } from '../../components/MobileFormSteps';
const steps = [{ id: 1, label: 'Identificación' }, { id: 2, label: 'Domicilios' }, { id: 3, label: 'Representantes' }];
describe('compact form navigation', () => {
  it('exposes complete labels and the actual controlled position', () => {
    render(<MobileFormSteps steps={steps} currentStep={2} onSelect={vi.fn()} />);
    expect(screen.getByText('Paso 2 de 3')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Paso del registro' })).toHaveValue('2');
    expect(screen.getByRole('option', { name: '3. Representantes' })).toBeInTheDocument();
  });
  it('delegates navigation to the existing validator without inventing progress', () => {
    const validate = vi.fn();
    render(<MobileFormSteps steps={steps} currentStep={1} onSelect={validate} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    expect(validate).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getByRole('combobox')).toHaveValue('1');
  });
  it('retains complete accessible step identity in the compact registration variant', () => {
    const validate = vi.fn();
    render(<MobileFormSteps compact steps={steps} currentStep={2} onSelect={validate} />);
    expect(screen.getByText('Paso 2/3')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Paso del registro' })).toHaveValue('2');
    expect(screen.getByRole('option', { name: '3. Representantes' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(validate).toHaveBeenCalledOnce(); expect(validate).toHaveBeenCalledWith(1);
    expect(screen.getByRole('combobox')).toHaveValue('2');
  });
});
