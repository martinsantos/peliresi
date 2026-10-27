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
