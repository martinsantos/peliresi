import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NativeSelect } from './NativeSelect';

afterEach(cleanup);
test('select has an exact associated label, without including option contents', () => {
  const change = vi.fn();
  render(<NativeSelect label="Establecimiento para operar" value="norte" onChange={change}>
    <option value="norte">Planta Norte · NORTE</option><option value="sur">Planta Sur · SUR</option>
  </NativeSelect>);
  const select = screen.getByLabelText('Establecimiento para operar', { exact: true });
  expect(select).toBe(screen.getByRole('combobox', { name: 'Establecimiento para operar' }));
  expect(select).toHaveValue('norte');
  fireEvent.change(select, { target: { value: 'sur' } });
  expect(change).toHaveBeenCalledExactlyOnceWith('sur');
  expect(document.activeElement).not.toBe(select);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
test('multiple native selectors retain distinct associations', () => {
  render(<><NativeSelect label="Empresa" value="a" onChange={() => {}}><option value="a">QA Empresa</option></NativeSelect>
    <NativeSelect label="Actividad autorizada" value="g" onChange={() => {}}><option value="g">Generador</option></NativeSelect></>);
  const company = screen.getByLabelText('Empresa', { exact: true });
  const activity = screen.getByLabelText('Actividad autorizada', { exact: true });
  expect(company.id).not.toBe(activity.id);
  expect(company).toHaveAccessibleName('Empresa');
  expect(activity).toHaveAccessibleName('Actividad autorizada');
});
