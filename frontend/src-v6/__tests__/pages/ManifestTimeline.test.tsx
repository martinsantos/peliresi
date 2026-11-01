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
  for (const title of ['Manifiesto creado', 'Firma del generador', 'Incidente registrado', 'Estado rectificado']) {
    expect(screen.getByText(title, { exact: true })).toHaveClass('text-neutral-900');
  }
});

it('uses the same human event labels as Monitor without exposing structured metadata', () => {
  const manifiesto = { eventos: [
    { id:'enabled', tipo:'CERTIFICACION_OPERADOR_V1', descripcion:'Certificaciones emitidas', createdAt:'2026-10-24T12:00:00Z' },
    { id:'issued', tipo:'CERTIFICADO_OPERADOR_V1', descripcion:JSON.stringify({tipo:'FINAL',numero:'QA-001'}), createdAt:'2026-10-24T12:01:00Z' },
  ] } as unknown as Manifiesto;
  const {container}=render(<ManifiestoTimeline eventos={manifiesto.eventos} manifiesto={manifiesto}/>);
  expect(screen.getByText('Gestión de certificados configurada',{exact:true})).toBeVisible();
  expect(screen.getByText(/Este evento no es un certificado emitido/)).toBeVisible();
  expect(screen.getByText('Certificado emitido',{exact:true})).toBeVisible();
  expect(container.textContent).not.toContain('CERTIFICACION_OPERADOR_V1');
  expect(container.textContent).not.toContain('{"tipo":');
});

it('explains ambiguous approval timestamps without inventing or hiding events', () => {
  const events = [
    { id: 'start', tipo: 'INICIO_COORDINACION', descripcion: 'Coordinación iniciada', createdAt: '2026-10-30T12:00:00.000Z' },
    { id: 'approval', tipo: 'APROBACION_TRANSPORTISTA', descripcion: 'Aprobación registrada', createdAt: '2026-10-30T12:00:01.000Z' },
  ] as Manifiesto['eventos'];
  render(<ManifiestoTimeline eventos={events} manifiesto={{ eventos: events }} />);
  expect(screen.getByRole('note')).toHaveTextContent('Las fechas de acciones simultáneas pueden aparecer fuera de orden');
  expect(screen.getByText('Coordinación iniciada', { selector: 'p.font-semibold' })).toBeVisible();
  expect(screen.getByText('Transporte aprobó')).toBeVisible();
});

it('does not add a warning when the recorded approvals precede coordination', () => {
  const events = [
    { id: 'start', tipo: 'INICIO_COORDINACION', descripcion: '', createdAt: '2026-10-30T12:00:02.000Z' },
    { id: 'approval', tipo: 'APROBACION_TRANSPORTISTA', descripcion: '', createdAt: '2026-10-30T12:00:01.000Z' },
  ] as Manifiesto['eventos'];
  render(<ManifiestoTimeline eventos={events} manifiesto={{ eventos: events }} />);
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

it('shows recorded event times in Mendoza and handles invalid dates', () => {
  const events = [
    { id: 'valid', tipo: 'CREACION', descripcion: 'Creación', createdAt: '2026-10-21T01:15:00.000Z' },
    { id: 'invalid', tipo: 'INCIDENTE', descripcion: 'Incidente', createdAt: 'invalid' },
  ] as Manifiesto['eventos'];
  render(<ManifiestoTimeline eventos={events} manifiesto={{ eventos: events }} />);
  expect(screen.getByText('20/10/2026, 22:15:00 · Mendoza')).toHaveAttribute('datetime', '2026-10-21T01:15:00.000Z');
  expect(screen.getByText('Fecha no disponible')).toBeVisible();
});
