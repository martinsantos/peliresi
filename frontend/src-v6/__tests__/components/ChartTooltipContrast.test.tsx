import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ChartTooltip } from '../../components/charts/ChartTooltip';

it('keeps chart series color in a key, not in small tooltip text', () => {
  render(<ChartTooltip active label="QA departamento" payload={[
    { name: 'Transportistas', value: 1, color: '#ea580c' },
    { name: 'Generadores', value: 0, fill: '#9333ea' },
  ]} />);
  for (const [name, count, color] of [['Transportistas', '1', 'rgb(234, 88, 12)'], ['Generadores', '0', 'rgb(147, 51, 234)']]) {
    const row = screen.getByText(name, { exact: false });
    expect(row).toHaveClass('text-neutral-700');
    expect(row.style.color).toBe('');
    expect(within(row).getByText(count)).toBeVisible();
    expect(row.querySelector('[aria-hidden="true"]')).toHaveStyle({ backgroundColor: color });
  }
});

it('retains full names and values without claiming a new quantity or hiding missing color', () => {
  render(<ChartTooltip active label="Período QA" payload={[{ name: 'QA nombre completo de la serie sin abreviar', value: '2 L · 3 kg' }]} />);
  expect(screen.getByText('Período QA')).toBeVisible();
  const row = screen.getByText('QA nombre completo de la serie sin abreviar', { exact: false });
  expect(within(row).getByText('2 L · 3 kg')).toBeVisible();
  expect(row.querySelector('[aria-hidden="true"]')).toBeNull();
});

it('does not fabricate a tooltip for inactive or absent series', () => {
  const { container, rerender } = render(<ChartTooltip active={false} payload={[{ name: 'QA', value: 1 }]} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<ChartTooltip active payload={[]} />);
  expect(container).toBeEmptyDOMElement();
});
