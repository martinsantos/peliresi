import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldReadinessPanel } from '../../pages/inspecciones/InspeccionExpedientePage';

describe('field review readiness', () => {
  it('accepts completed field controls without demanding the next-stage deadline or closure timestamp', () => {
    render(<FieldReadinessPanel state="EN_CAMPO" items={[{ obligatorio: true, resultado: 'CUMPLE' }, { obligatorio: false, resultado: 'PENDIENTE' }]} comparisons={[{ resultado: 'COINCIDE' }]} pendingEvidenceCount={0} />);
    expect(screen.getByText('4/4 completos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preparación para enviar a revisión' })).toBeInTheDocument();
    expect(screen.queryByText('Plazo de respuesta')).not.toBeInTheDocument();
    expect(screen.queryByText('Cierre de campo confirmado')).not.toBeInTheDocument();
  });

  it('requires a nonempty declared comparison, as the server does', () => {
    render(<FieldReadinessPanel state="EN_CAMPO" items={[{ obligatorio: true, resultado: 'CUMPLE' }]} comparisons={[]} pendingEvidenceCount={0} />);
    expect(screen.getByText('3/4 completos')).toBeInTheDocument();
  });

  it('reports pending required controls and unsynchronized captures', () => {
    render(<FieldReadinessPanel state="EN_CAMPO" items={[{ obligatorio: true, resultado: 'PENDIENTE' }]} comparisons={[{ resultado: 'PENDIENTE' }]} pendingEvidenceCount={1} />);
    expect(screen.getByText('1/4 completos')).toBeInTheDocument();
  });

  it('does not call a planned inspection ready to submit before field work starts', () => {
    render(<FieldReadinessPanel state="PLANIFICADA" items={[{ obligatorio: true, resultado: 'CUMPLE' }]} comparisons={[{ resultado: 'COINCIDE' }]} pendingEvidenceCount={0} />);
    expect(screen.getByText('3/4 completos')).toBeInTheDocument();
    expect(screen.getByText('Inspección iniciada en campo')).toBeInTheDocument();
  });
});
