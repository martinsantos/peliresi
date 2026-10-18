import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ManifiestoTimeline from '../../pages/manifiestos/components/ManifiestoTimeline';
import { EstadoManifiesto, type Manifiesto } from '../../types/models';

it('does not mark real past events as pending based on their index or the current workflow state', () => {
  const manifiesto = {
    estado: EstadoManifiesto.BORRADOR,
    eventos: ['CREACION', 'FIRMA', 'INCIDENTE', 'REVERSION'].map((tipo, index) => ({ id: String(index), tipo, descripcion: `QA ${tipo}`, createdAt: '2026-09-26T03:00:00Z', usuario: { nombre: 'QA' } })),
  } as unknown as Manifiesto;
  render(<ManifiestoTimeline eventos={manifiesto.eventos} manifiesto={manifiesto} />);
  for (const title of ['CREACION', 'FIRMA', 'INCIDENTE', 'REVERSION']) {
    expect(screen.getByText(title, { exact: true })).toHaveClass('text-neutral-900');
  }
});
