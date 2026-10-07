import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionWorkspace } from '../../pages/inspecciones/InspectionWorkspace';
import { readInspectionResume } from '../../services/inspectionResume';

function setup(hash = '') {
  const onBeforeNavigate = vi.fn();
  render(<MemoryRouter initialEntries={['/inspecciones/qa' + hash]}>
    <InspectionWorkspace guided defaultStep="contexto" onBeforeNavigate={onBeforeNavigate} resumeIdentity={{ userId: 'inspector-1', inspectionId: 'qa' }}
      saveAction={<button>Guardar borrador</button>}
      steps={[
        { id: 'contexto', label: 'Contexto', title: 'Preparar visita', description: 'Datos generales', content: <input aria-label="Ubicación QA" defaultValue="" /> },
        { id: 'checklist', label: 'Checklist', title: 'Controles', description: 'Verificación', anchors: [{ id: 'DOC-01', label: 'Documento', detail: 'Pendiente', group: 'Documentación', reviewed: false }], content: <p>Control de prueba</p> },
      ]}
      reference={[{ id: 'trazabilidad', label: 'Trazabilidad', title: 'Registro', description: 'Notas', content: <textarea aria-label="Nota sin enviar" /> }]} />
  </MemoryRouter>);
  return { onBeforeNavigate };
}

describe('InspectionWorkspace navigation contract', () => {
  beforeEach(() => localStorage.clear());

  it('opens a section directly without submitting and flushes the draft', () => {
    const { onBeforeNavigate } = setup();
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.queryByText('Control de prueba')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Controles', exact: true }));
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Controles', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  it('numbers section groups without claiming completion or changing accessible destinations', () => {
    setup('#checklist');
    const nav = screen.getByRole('navigation', { name: 'Secciones del expediente' });
    const current = within(nav).getByRole('link', { name: 'Controles', exact: true });
    const number = within(current).getByText('2', { exact: true });
    expect(number).toHaveAttribute('aria-hidden', 'true');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('bg-primary-700', 'text-white');
    expect(within(nav).getByRole('link', { name: 'Expediente', exact: true })).toHaveTextContent('4');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('preserves a child note when leaving and returning, and never offers generic save for it', () => {
    setup('#trazabilidad');
    const note = screen.getByRole('textbox', { name: 'Nota sin enviar' });
    fireEvent.change(note, { target: { value: 'Observación pendiente de registrar' } });
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Visita', exact: true }));
    expect(note).not.toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Expediente', exact: true }));
    expect(screen.getByRole('textbox', { name: 'Nota sin enviar' })).toHaveValue('Observación pendiente de registrar');
  });

  it('keeps document anchors and safe fallback for malformed hashes', () => {
    setup('#%E0%A4%A');
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Controles', exact: true })).toHaveAttribute('href', '#checklist');
    const bar = screen.getByTestId('inspection-action-bar');
    expect(bar.className).not.toMatch(/\b(sticky|fixed|absolute)\b/);
    expect(within(bar).getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
  });

  it('keeps a mobile navigation landmark and exposes direct links to field points', () => {
    setup('#checklist/DOC-01');
    expect(screen.getByTestId('inspection-navigation')).toHaveClass('sticky', 'top-0');
    expect(readInspectionResume('inspector-1', 'qa')).toMatchObject({ hash: '#checklist/DOC-01', label: 'Checklist · Documento' });
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
  });

  it('remembers the exact selected control for the next visit', () => {
    setup('#checklist/DOC-01');
    expect(readInspectionResume('inspector-1', 'qa')).toMatchObject({ hash: '#checklist/DOC-01', label: 'Checklist · Documento' });
  });

  it('does not leave the current section when protecting the draft fails', () => {
    const { onBeforeNavigate } = setup();
    onBeforeNavigate.mockReturnValue(false);
    fireEvent.click(screen.getByRole('link', { name: 'Controles', exact: true }));
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Visita', exact: true })).toHaveAttribute('aria-current', 'page');
  });
});
