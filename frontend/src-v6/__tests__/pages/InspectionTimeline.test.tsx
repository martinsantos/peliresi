import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InspectionTimeline } from '../../pages/inspecciones/InspectionTimeline';
import type { Inspection, InspectionEvent } from '../../types/inspection';

function eventFixture(overrides: Partial<InspectionEvent>): InspectionEvent {
  return {
    id: 'event-default',
    tipo: 'CAMBIO_ESTADO',
    titulo: 'Actuación registrada',
    detalle: null,
    estadoDesde: null,
    estadoHasta: null,
    visibleActor: true,
    canal: 'SISTEMA',
    estadoEntrega: null,
    destinatario: null,
    createdAt: '2026-09-21T12:30:00.000Z',
    usuario: { id: 'admin-1', nombre: 'Ana', apellido: 'Auditora' },
    adjuntos: [],
    ...overrides,
  };
}

function inspectionFixture(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'inspection-1',
    numero: 'I-2026-000001',
    numeroActa: 'ACTA-2026-001',
    tipoActor: 'GENERADOR',
    estado: 'NOTIFICADA',
    inspectorId: 'inspector-1',
    inspector: { id: 'inspector-1', nombre: 'Ada', apellido: 'Inspectora' },
    generador: { id: 'generator-1', razonSocial: 'Planta Auditada SA', cuit: '30-12345678-9' },
    transportista: null,
    operador: null,
    ubicacion: 'Parque Industrial, Mendoza',
    fechaProgramada: '2026-09-20T12:00:00.000Z',
    iniciadaAt: '2026-09-20T12:15:00.000Z',
    cerradaCampoAt: '2026-09-20T15:00:00.000Z',
    plazoRespuestaAt: '2026-09-30T15:00:00.000Z',
    observaciones: 'Inspección documentada.',
    datosActa: {},
    informeTecnico: {},
    version: 7,
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-21T12:30:00.000Z',
    items: [],
    comparaciones: [],
    evidencias: [],
    eventos: [],
    ...overrides,
  };
}

describe('InspectionTimeline', () => {
  it('shows the operational audit history, event provenance, dates, and dossier deadline', () => {
    const inspection = inspectionFixture({
      eventos: [
        eventFixture({
          id: 'event-transition',
          titulo: 'Expediente aprobado',
          estadoDesde: 'EN_REVISION',
          estadoHasta: 'NOTIFICADA',
        }),
        eventFixture({
          id: 'event-response',
          tipo: 'RESPUESTA_ACTOR',
          titulo: 'Descargo incorporado',
          canal: 'PORTAL_ACTOR',
          usuario: { id: 'actor-1', nombre: 'Representante', apellido: 'Legal' },
        }),
        eventFixture({
          id: 'event-internal',
          tipo: 'COMENTARIO_INTERNO',
          titulo: 'Análisis interno',
          visibleActor: false,
        }),
      ],
    });

    render(<InspectionTimeline inspection={inspection} canComment={false} busy={false} onAdd={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Historial del expediente' })).toBeInTheDocument();
    expect(screen.getByText('Registro operativo y auditoría')).toBeInTheDocument();
    expect(screen.getAllByText('Organismo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inspeccionado').length).toBeGreaterThan(0);
    expect(screen.getByText('Nota interna')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P'
      && /Estado:\s*(?:En revisión|EN[ _]REVISION)\s*→\s*(?:Notificada|NOTIFICADA)/i.test(element.textContent || ''))).toBeInTheDocument();
    expect(screen.getAllByText(/21\/0?9\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Plazo del expediente/i)).toBeInTheDocument();
    expect(screen.getByText(/30\s+(?:sept|sep)/i)).toBeInTheDocument();
  });

  it('makes a prepared notification unmistakably non-dispatched', () => {
    const inspection = inspectionFixture({
      eventos: [eventFixture({
        id: 'event-notification',
        tipo: 'NOTIFICACION_PREPARADA',
        titulo: 'Notificación preparada',
        canal: 'EMAIL',
        estadoEntrega: 'NO_ENVIADO',
        destinatario: 'responsable@planta.test',
      })],
    });

    render(<InspectionTimeline inspection={inspection} canComment={false} busy={false} onAdd={vi.fn()} />);

    expect(screen.getByText(/Correo no enviado/i)).toBeInTheDocument();
    expect(screen.getByText(/No se envió ninguna comunicación externa/i)).toBeInTheDocument();
    expect(screen.getByText(/responsable@planta\.test/i)).toBeInTheDocument();
  });

  it('exposes a fully labelled form and registers a notification only as an internal record', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<InspectionTimeline inspection={inspectionFixture()} canComment busy={false} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: 'Agregar nota' }));
    const type = screen.getByLabelText('Tipo de registro');
    const detail = screen.getByLabelText('Detalle del registro');
    const attachment = screen.getByLabelText('Adjunto del registro');
    const submit = screen.getByRole('button', { name: 'Registrar nota' });

    expect(type).toBeInstanceOf(HTMLSelectElement);
    expect(detail).toBeInstanceOf(HTMLTextAreaElement);
    expect(attachment).toHaveAttribute('type', 'file');
    expect(submit).toBeDisabled();
    expect(screen.queryByRole('option', { name: /respuesta del inspeccionado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /requerimiento al inspeccionado/i })).not.toBeInTheDocument();

    await user.selectOptions(type, 'NOTIFICACION_PREPARADA');
    const recipient = screen.getByLabelText('Destinatario (registro interno)');
    expect(screen.getByText(/No se envió ninguna comunicación externa/i)).toBeInTheDocument();

    await user.type(recipient, 'responsable@planta.test');
    await user.type(detail, 'Se dejó preparada la comunicación para revisión humana.');
    const file = new File(['constancia'], 'constancia.pdf', { type: 'application/pdf' });
    await user.upload(attachment, file);
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onAdd).toHaveBeenCalledWith({
      tipo: 'NOTIFICACION_PREPARADA',
      titulo: 'Borrador de notificación',
      detalle: 'Se dejó preparada la comunicación para revisión humana.',
      visibleActor: false,
      destinatario: 'responsable@planta.test',
    }, file);
  });

  it('does not invent a dossier deadline when none was defined', () => {
    render(<InspectionTimeline
      inspection={inspectionFixture({ plazoRespuestaAt: null, eventos: [eventFixture({ id: 'event-without-deadline' })] })}
      canComment={false}
      busy={false}
      onAdd={vi.fn()}
    />);

    expect(screen.queryByText(/Plazo del expediente/i)).not.toBeInTheDocument();
  });
});
