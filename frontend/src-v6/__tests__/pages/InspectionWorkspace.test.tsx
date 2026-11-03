import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionWorkspace } from '../../pages/inspecciones/InspectionWorkspace';
import { readInspectionResume } from '../../services/inspectionResume';

function setup(hash = '') {
  const onBeforeNavigate = vi.fn();
  render(<MemoryRouter initialEntries={['/inspecciones/qa' + hash]}>
    <InspectionWorkspace guided defaultStep="contexto" onBeforeNavigate={onBeforeNavigate} resumeIdentity={{ userId: 'inspector-1', inspectionId: 'qa', owner: 'context-A' }}
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
    fireEvent.click(screen.getByRole('link', { name: 'Constataciones', exact: true }));
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Constataciones', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  it('numbers section groups without claiming completion or changing accessible destinations', () => {
    setup('#checklist');
    const nav = screen.getByRole('navigation', { name: 'Secciones del expediente' });
    const current = within(nav).getByRole('link', { name: 'Constataciones', exact: true });
    const number = within(current).getByText('2', { exact: true });
    expect(number).toHaveAttribute('aria-hidden', 'true');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('bg-primary-700', 'text-white', 'hover:text-white', 'focus-visible:text-white', 'transition-none', 'flex-1');
    expect(within(nav).getByRole('link', { name: 'Revisar y firmar', exact: true })).toHaveTextContent('4');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('preserves a child note when leaving and returning, and never offers generic save for it', () => {
    setup('#trazabilidad');
    const note = screen.getByRole('textbox', { name: 'Nota sin enviar' });
    fireEvent.change(note, { target: { value: 'Observación pendiente de registrar' } });
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Visita y lugar', exact: true }));
    expect(note).not.toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Revisar y firmar', exact: true }));
    expect(screen.getByRole('textbox', { name: 'Nota sin enviar' })).toHaveValue('Observación pendiente de registrar');
  });

  it('keeps document anchors and safe fallback for malformed hashes', () => {
    setup('#%E0%A4%A');
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Constataciones', exact: true })).toHaveAttribute('href', '#checklist');
    const bar = screen.getByTestId('inspection-action-bar');
    expect(bar.className).not.toMatch(/\b(sticky|fixed|absolute)\b/);
    expect(within(bar).getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
  });

  it('keeps a mobile navigation landmark and exposes direct links to field points', () => {
    setup('#checklist/DOC-01');
    expect(screen.getByTestId('inspection-navigation')).toHaveClass('sticky', 'top-0');
    expect(readInspectionResume('inspector-1', 'qa', 'context-A')).toMatchObject({ hash: '#checklist/DOC-01', label: 'Checklist · Documento' });
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
  });

  it('remembers the exact selected control for the next visit', () => {
    setup('#checklist/DOC-01');
    expect(readInspectionResume('inspector-1', 'qa', 'context-A')).toMatchObject({ hash: '#checklist/DOC-01', label: 'Checklist · Documento' });
  });

  it('does not leave the current section when protecting the draft fails', () => {
    const { onBeforeNavigate } = setup();
    onBeforeNavigate.mockReturnValue(false);
    fireEvent.click(screen.getByRole('link', { name: 'Constataciones', exact: true }));
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Visita y lugar', exact: true })).toHaveAttribute('aria-current', 'page');
  });
  it('offers a visible continuation and keeps unsaved fields mounted across steps', () => {
    const { onBeforeNavigate } = setup();
    fireEvent.change(screen.getByLabelText('Ubicación QA'), { target: { value: 'Texto protegido' } });
    const navigation = screen.getByRole('navigation', { name: 'Continuar el recorrido' });
    fireEvent.click(within(navigation).getByRole('link', { name: /Continuar:/ }));
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('link', { name: 'Visita y lugar', exact: true }));
    expect(screen.getByLabelText('Ubicación QA')).toHaveValue('Texto protegido');
  });

  it('protects the draft when continuing from the end of a form', () => {
    const { onBeforeNavigate } = setup();
    onBeforeNavigate.mockReturnValue(false);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Continuar el recorrido' })).getByRole('link', { name: /Continuar:/ }));
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
  });

  it('exposes every review destination without a sideways-only navigation strip', () => {
    render(<MemoryRouter initialEntries={['/inspecciones/qa#firma']}>
      <InspectionWorkspace pageScroll guided defaultStep="firma" onBeforeNavigate={() => true}
        steps={[{ id: 'revision', label: 'Resumen', title: 'Revisión', description: '', content: <p>Resumen del acta</p> }]}
        reference={['firma', 'informe-tecnico', 'trazabilidad', 'verificacion'].map(id => ({ id, label: id, title: id, description: '', content: <p>{id}</p> }))} />
    </MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Apartados de Revisar y firmar' });
    expect(within(nav).getAllByRole('link')).toHaveLength(5);
    expect(nav.className).not.toContain('overflow-x-auto');
    fireEvent.click(within(nav).getByRole('link', { name: 'Verificación', exact: true }));
    expect(screen.getByRole('region', { name: 'verificacion' })).toBeVisible();
    expect(screen.getByTestId('inspection-navigation')).not.toHaveClass('sticky');
  });

});
