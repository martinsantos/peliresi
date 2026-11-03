import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldReadinessPanel } from '../../pages/inspecciones/InspeccionExpedientePage';
describe('field review readiness', () => {
  it('does not demand optional controls or next-stage administrative deadlines', () => {
    render(<FieldReadinessPanel state="EN_CAMPO" items={[{ obligatorio: true, resultado: 'CUMPLE' }, { obligatorio: false, resultado: 'PENDIENTE' }]} comparisons={[{ resultado: 'COINCIDE' }]} pendingEvidenceCount={0} />);
    expect(screen.getByRole('heading', { name: 'Listo para enviar a revisión' })).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Plazo de respuesta')).toBeNull();
  });
  it('links a missing declaration to its actionable task', () => {
    render(<FieldReadinessPanel state="EN_CAMPO" items={[]} comparisons={[]} pendingEvidenceCount={0} />);
    expect(screen.getByRole('link', { name: 'Revisar la declaración del actor' })).toHaveAttribute('href', '#declaracion');
  });
  it('counts only unresolved required items and links every blocker', () => {
    render(<FieldReadinessPanel state="EN_CAMPO" items={[{ obligatorio: true, resultado: 'PENDIENTE' }]} comparisons={[{ resultado: 'PENDIENTE' }]} pendingEvidenceCount={1} />);
    expect(screen.getByRole('link', { name: '1 controles obligatorios pendientes' })).toHaveAttribute('href', '#checklist');
    expect(screen.getByRole('link', { name: '1 datos declarados por contrastar' })).toHaveAttribute('href', '#declaracion');
    expect(screen.getByRole('link', { name: '1 capturas por sincronizar' })).toHaveAttribute('href', '#evidencias');
    expect(screen.queryByText('Listo para enviar a revisión')).toBeNull();
  });
  it('cannot call a planned visit ready for review', () => {
    render(<FieldReadinessPanel state="PLANIFICADA" items={[]} comparisons={[{ resultado: 'COINCIDE' }]} pendingEvidenceCount={0} />);
    expect(screen.getByRole('link', { name: 'Iniciar la visita' })).toHaveAttribute('href', '#resumen');
  });
});
