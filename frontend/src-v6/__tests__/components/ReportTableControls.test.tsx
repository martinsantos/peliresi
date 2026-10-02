import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ReportRow } from '../../pages/reportes/tabs/ReportTableControls';
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function setup(to?: string) {
  render(<MemoryRouter initialEntries={['/reportes']}><table><tbody><ReportRow to={to}><td>QA fila <button>QA secundaria</button><input aria-label="QA dato" /></td></ReportRow></tbody></table><Location /></MemoryRouter>);
  return screen.getByRole('row');
}
describe('report row independent controls', () => {
  it('does not steal clicks from a child action or input', () => {
    setup('/manifiestos/qa');
    fireEvent.click(screen.getByRole('button', { name: 'QA secundaria' }));
    fireEvent.click(screen.getByLabelText('QA dato'));
    expect(screen.getByTestId('location')).toHaveTextContent('/reportes');
  });
  it('does not steal Enter from a child action', () => {
    setup('/manifiestos/qa');
    fireEvent.keyDown(screen.getByRole('button', { name: 'QA secundaria' }), { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/reportes');
  });
  it('opens the record with Space and keeps modified clicks untouched', () => {
    const row = setup('/manifiestos/qa');
    fireEvent.click(row, { ctrlKey: true });
    expect(screen.getByTestId('location')).toHaveTextContent('/reportes');
    fireEvent.keyDown(row, { key: ' ' });
    expect(screen.getByTestId('location')).toHaveTextContent('/manifiestos/qa');
  });
  it('never advertises a non-existent destination', () => {
    const row = setup();
    expect(row).not.toHaveAttribute('tabindex');
    expect(row).not.toHaveClass('cursor-pointer');
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/reportes');
  });
});
