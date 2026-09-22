import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InspectionWorkspace } from '../../pages/inspecciones/InspectionWorkspace';

function setup(hash = '') {
  const onBeforeNavigate = vi.fn();
  render(<MemoryRouter initialEntries={['/inspecciones/qa' + hash]}>
    <InspectionWorkspace guided defaultStep="contexto" onBeforeNavigate={onBeforeNavigate}
      saveAction={<button>Guardar borrador</button>}
      steps={[
        { id: 'contexto', label: 'Contexto', title: 'Preparar visita', description: 'Datos generales', content: <input aria-label="Ubicación QA" defaultValue="" /> },
        { id: 'checklist', label: 'Checklist', title: 'Controles', description: 'Verificación', content: <p>Control de prueba</p> },
      ]}
      reference={[{ id: 'trazabilidad', label: 'Trazabilidad', title: 'Registro', description: 'Notas', content: <textarea aria-label="Nota sin enviar" /> }]} />
  </MemoryRouter>);
  return { onBeforeNavigate };
}

describe('InspectionWorkspace navigation contract', () => {
  it('shows exactly one task, advances without submitting and flushes the draft', () => {
    const { onBeforeNavigate } = setup();
    expect(screen.getByRole('heading', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.queryByText('Control de prueba')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Controles' })).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Checklist' })).toHaveAttribute('aria-current', 'step');
  });

  it('preserves a child note when leaving and returning, and never offers generic save for it', () => {
    setup('#trazabilidad');
    const note = screen.getByRole('textbox', { name: 'Nota sin enviar' });
    fireEvent.change(note, { target: { value: 'Observación pendiente de registrar' } });
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Contexto' }));
    expect(note).not.toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Trazabilidad' }));
    expect(screen.getByRole('textbox', { name: 'Nota sin enviar' })).toHaveValue('Observación pendiente de registrar');
  });

  it('keeps document anchors and safe fallback for malformed hashes', () => {
    setup('#%E0%A4%A');
    expect(screen.getByRole('heading', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Checklist' })).toHaveAttribute('href', '#checklist');
    const bar = screen.getByTestId('inspection-action-bar');
    expect(bar.className).not.toMatch(/\b(sticky|fixed|absolute)\b/);
    expect(within(bar).getByRole('button', { name: 'Siguiente' })).toBeVisible();
  });
});
