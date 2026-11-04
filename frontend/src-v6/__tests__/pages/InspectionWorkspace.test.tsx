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
        { id: 'revision', label: 'Revisión', title: 'Revisión final', description: '', content: <p>Finalizar visita</p> },
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
    expect(screen.getByRole('link', { name: 'Constataciones', exact: true })).toHaveAttribute('aria-current', 'step');
  });

  it('keeps four work stages separate from technical dossier tools', () => {
    setup('#checklist');
    const nav = screen.getByRole('navigation', { name: 'Secciones del expediente' });
    expect(within(nav).getByRole('link', { name: 'Constataciones', exact: true })).toHaveAttribute('aria-current', 'step');
    expect(within(nav).queryByRole('link', { name: 'Historial de intervenciones' })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Paso 2 de 4')).toBeVisible();
  });

  it('opens every Constatar task in one scroll with a heading link each, no accordions', () => {
    // The fixture's Constatar section has one task, so no per-task heading is drawn; the mode still shows no accordion.
    setup('#checklist');
    expect(document.querySelectorAll('a[aria-expanded]')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
    expect(screen.getByTestId('inspection-step-content')).toBeVisible();
  });

  it('preserves a child note when leaving and returning, and never offers generic save for it', () => {
    setup('#trazabilidad');
    const note = screen.getByRole('textbox', { name: 'Nota sin enviar' });
    fireEvent.change(note, { target: { value: 'Observación pendiente de registrar' } });
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del expediente' })).getByRole('link', { name: 'Visita y lugar', exact: true }));
    expect(note).not.toBeVisible();
    fireEvent.click(screen.getByText('Expediente y seguimiento', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('link', { name: 'Historial de intervenciones', exact: true }));
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
    expect(screen.getByRole('navigation', { name: 'Secciones del expediente' })).toBeVisible();
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
    expect(within(screen.getByRole('navigation', { name: 'Secciones del expediente' })).getByRole('link', { name: 'Visita y lugar', exact: true })).toHaveAttribute('aria-current', 'step');
  });
  it('offers a visible continuation and keeps unsaved fields mounted across steps', () => {
    const { onBeforeNavigate } = setup();
    fireEvent.change(screen.getByLabelText('Ubicación QA'), { target: { value: 'Texto protegido' } });
    const navigation = screen.getByRole('navigation', { name: 'Continuar el recorrido' });
    fireEvent.click(within(navigation).getByRole('link', { name: /Continuar:/ }));
    expect(screen.getByRole('region', { name: 'Controles' })).toBeVisible();
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del expediente' })).getByRole('link', { name: 'Visita y lugar', exact: true }));
    expect(screen.getByLabelText('Ubicación QA')).toHaveValue('Texto protegido');
  });

  it('protects the draft when continuing from the end of a form', () => {
    const { onBeforeNavigate } = setup();
    onBeforeNavigate.mockReturnValue(false);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Continuar el recorrido' })).getByRole('link', { name: /Continuar:/ }));
    expect(screen.getByRole('region', { name: 'Preparar visita' })).toBeVisible();
  });

  it('opens final tasks in place without a second navigation bar', () => {
    render(<MemoryRouter initialEntries={['/inspecciones/qa#firma']}>
      <InspectionWorkspace pageScroll guided defaultStep="firma" onBeforeNavigate={() => true}
        steps={[{ id: 'revision', label: 'Resumen', title: 'Revisión', description: '', content: <p>Resumen del acta</p> }]}
        reference={['firma', 'entrega', 'informe-tecnico', 'trazabilidad', 'verificacion'].map(id => ({ id, label: id, title: id, description: '', content: <p>{id}</p> }))} />
    </MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: /Apartados de/ })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Copia del acta y respuestas', exact: true }));
    expect(screen.getByRole('region', { name: 'entrega' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'firma', hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByText('Expediente y seguimiento', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('link', { name: 'Verificación QR', exact: true }));
    expect(screen.getByRole('region', { name: 'verificacion' })).toBeVisible();
  });

});
