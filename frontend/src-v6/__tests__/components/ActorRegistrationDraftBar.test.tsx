import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActorRegistrationDraftBar } from '../../components/ActorRegistrationDraftBar';
import type { useActorRegistrationDraft } from '../../hooks/useActorRegistrationDraft';

type Draft = ReturnType<typeof useActorRegistrationDraft>;
function draft(overrides: Partial<Draft> = {}): Draft {
  return { owner: 'qa-owner', available: null, saved: true, error: null, restoring: false, blocked: false,
    checkpoint: vi.fn(async () => true), restore: vi.fn(async () => {}), discard: vi.fn(async () => {}), clear: vi.fn(async () => true), cloudSaved: true, saving: false, conflict: false, reviewRemote: vi.fn(async () => {}), assertSession: vi.fn(), retry: vi.fn(), ...overrides };
}
describe('registration recovery remains visible without burying mobile fields', () => {
  it('keeps truthful local status and the save action visible without the permanent explanatory block', () => {
    const current = draft(); render(<ActorRegistrationDraftBar draft={current} />);
    expect(screen.getByRole('status')).toHaveTextContent('Guardado en SITREP · podés continuar en otro dispositivo');
    expect(screen.getByText(/Podés recuperar los datos y adjuntos durante 30 días/)).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador', exact: true }));
    expect(current.checkpoint).toHaveBeenCalledOnce();
  });
  it('opens and closes the storage limits with an explicitly labelled control', () => {
    render(<ActorRegistrationDraftBar draft={draft()} />);
    const control = screen.getByRole('button', { name: 'Información del borrador', exact: true });
    expect(control).toHaveAttribute('aria-expanded', 'false'); fireEvent.click(control);
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toHaveTextContent('No se guardan contraseñas.');
    expect(control.getAttribute('aria-controls')).toBe(screen.getByRole('note').id);
    fireEvent.click(control); expect(screen.queryByRole('note')).toBeNull();
  });
  it('never hides the required recovery decision behind the information control', () => {
    const current = draft({ available: { version: 1, owner: 'qa-owner', scope: 'admin:GENERADOR:new', savedAt: Date.now(), data: { form: { razonSocial: 'QA' } } } });
    render(<ActorRegistrationDraftBar draft={current} />);
    expect(screen.getByRole('button', { name: 'Recuperar borrador', exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuar sin recuperar', exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar borrador', exact: true }));
    expect(current.restore).toHaveBeenCalledOnce(); expect(screen.queryByRole('note')).toBeNull();
  });
  it('keeps storage failures and blocked editing visible and makes retry actionable', () => {
    const current = draft({ saved: false, blocked: true, error: 'QA no se pudo guardar en este dispositivo' });
    render(<ActorRegistrationDraftBar draft={current} />);
    expect(screen.getAllByRole('alert').map(element => element.textContent).join(' ')).toContain('QA no se pudo guardar');
    expect(screen.getAllByRole('alert').map(element => element.textContent).join(' ')).toContain('No se sobrescribirá');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar edición', exact: true })); expect(current.retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('note')).toBeNull();
  });
});
