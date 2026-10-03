import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InspectionLocationField } from './InspectionLocationField';

const options = [{ label: 'Domicilio real', value: 'Planta 100' }];
describe('Explicit declared-location choice', () => {
  it('keeps an oversized official address intact but does not copy it into the shorter location field', () => {
    const long = 'A'.repeat(301);
    const change = vi.fn();
    render(<InspectionLocationField label="Ubicación" value="Lugar observado" onChange={change} options={[{ label: 'Domicilio legal', value: long }]} />);
    const option = screen.getByRole('button', { name: `Usar domicilio legal: ${long}` });
    expect(option).toBeDisabled();
    expect(screen.getByText(long)).toBeInTheDocument();
    expect(option).toHaveAccessibleDescription(/300 caracteres/);
    fireEvent.click(option);
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Ubicación')).toHaveValue('Lugar observado');
  });

  it('exposes the actual 300-character location limit without truncating a recovered draft', () => {
    render(<InspectionLocationField label="Ubicación" value={'A'.repeat(301)} onChange={vi.fn()} options={[]} />);
    expect(screen.getByLabelText('Ubicación')).toHaveAttribute('maxlength', '300');
    expect(screen.getByLabelText('Ubicación')).toHaveValue('A'.repeat(301));
    expect(screen.getByLabelText('Ubicación')).toHaveAttribute('aria-invalid', 'true');
  });
  it('never calls a change handler just because addresses arrive or change', () => {
    const change = vi.fn();
    const { rerender } = render(<InspectionLocationField label="Lugar" value="Portón observado" onChange={change} options={options} />);
    rerender(<InspectionLocationField label="Lugar" value="Portón observado" onChange={change} options={[{ label: 'Domicilio legal', value: 'Oficina 200' }]} />);
    expect(screen.getByLabelText('Lugar')).toHaveValue('Portón observado');
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar domicilio legal: Oficina 200' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('Oficina 200');
  });

  it('allows writing a place that is not in the registry', () => {
    const change = vi.fn();
    render(<InspectionLocationField label="Lugar" value="" onChange={change} options={options} />);
    fireEvent.change(screen.getByLabelText('Lugar'), { target: { value: 'Acceso constatado en campo' } });
    expect(change).toHaveBeenCalledExactlyOnceWith('Acceso constatado en campo');
  });

  it('exposes no suggestions when read-only and never bypasses permissions', () => {
    render(<InspectionLocationField label="Lugar" value="Confirmado" onChange={vi.fn()} options={options} disabled />);
    expect(screen.getByLabelText('Lugar')).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'Direcciones declaradas' })).not.toBeInTheDocument();
  });

  it('does not add an empty message panel for an actor without addresses', () => {
    render(<InspectionLocationField label="Lugar" value="" onChange={vi.fn()} options={[]} />);
    expect(screen.getByLabelText('Lugar')).toBeEnabled();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
