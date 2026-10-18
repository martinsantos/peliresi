import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingWizard from '../../components/OnboardingWizard';

describe('first session for an inspector', () => {
  beforeEach(() => localStorage.clear());
  it('explains internal assignments rather than telling an inspector to create manifests', () => {
    render(<OnboardingWizard rol="GENERADOR" esInspector userId="new-inspector" onDismiss={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Tu trabajo como inspector' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Las asignaciones llegan a la campana' })).toBeVisible();
    expect(screen.getByText(/No se envía correo ni push/)).toBeVisible();
  });
  it('preserves the administrator introduction and explicit dismissal', () => {
    const dismiss = vi.fn();
    render(<OnboardingWizard rol="ADMIN" esInspector userId="admin" onDismiss={dismiss} />);
    expect(screen.getByRole('heading', { name: 'Sos Administrador General del Sistema' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Saltar introducción' }));
    expect(localStorage.getItem('sitrep_onboarding_admin')).toBe('done');
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
