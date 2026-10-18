import { render, screen } from '@testing-library/react';
import { Factory } from 'lucide-react';
import { expect, it } from 'vitest';
import { KpiCard } from '../../components/charts/KpiCard';

it('does not fade the small metric label into its colored background', () => {
  render(<KpiCard label="Generadores registrados" value={0} icon={Factory} color="from-purple-700 to-purple-800" />);
  expect(screen.getByText('Generadores registrados')).toHaveClass('text-white');
  expect(screen.getByText('Generadores registrados')).not.toHaveClass('text-white/80');
});

it('keeps the metric scope legible instead of dimming critical period information', () => {
  render(<KpiCard label="En tránsito" value={1} sub="Esta página" icon={Factory} color="from-amber-700 to-amber-800" />);
  expect(screen.getByText('Esta página')).toHaveClass('text-white');
  expect(screen.getByText('Esta página')).not.toHaveClass('text-white/60');
});

it('preserves a true zero, full units, consumer typography and canonical icon', () => {
  const { container } = render(<KpiCard label="Residuos de esta página" value="0 kg · 2 l" valueClassName="text-xl break-words" icon={Factory} color="from-purple-700 to-purple-800" />);
  expect(screen.getByText('0 kg · 2 l')).toHaveClass('text-xl', 'break-words');
  expect(container.querySelector('svg.lucide-factory')).toBeInTheDocument();
  expect(container.querySelector('.bg-gradient-to-br')).toHaveClass('from-purple-700', 'to-purple-800');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
