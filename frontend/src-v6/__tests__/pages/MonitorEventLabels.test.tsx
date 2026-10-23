import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EventFeed } from '../../pages/monitor/components/EventFeed';
import { DepartureBoard } from '../../pages/monitor/components/DepartureBoard';
import { manifestEventDescription as describe, manifestEventLabel as label } from '../../utils/manifestEventPresentation';
afterEach(cleanup);
it('does not mistake certificate workflow activation for issuance', () => {
 expect(label('CERTIFICACION_OPERADOR_V1')).toBe('Certificación habilitada');
 expect(describe('CERTIFICACION_OPERADOR_V1','Certificaciones emitidas')).toContain('no es un certificado emitido');
 expect(label('CERTIFICADO_OPERADOR_V1')).toBe('Certificado emitido');
 expect(describe('CERTIFICADO_OPERADOR_V1', JSON.stringify({tipo:'FINAL',numero:'QA-001'}))).toBe('Certificación final total QA-001 emitida por el operador.');
});
it('individual approval and rejection retain the deciding party, not unanimous completion', () => {
 expect(describe('APROBACION_OPERADOR',JSON.stringify({version:1,rol:'OPERADOR',decision:'APROBADA'}))).toBe('El operador aprobó su participación.');
 expect(describe('RECHAZO_PARTE',JSON.stringify({version:1,rol:'TRANSPORTISTA',decision:'RECHAZADA',motivo:'QA revisión'}))).toBe('El transporte rechazó su participación: QA revisión');
});
it.each(['UNKNOWN_V7','',undefined])('unknown code %s has a neutral label, never a made-up state', type => {
 expect(label(type)).toBe('Actividad registrada'); expect(describe(type,'{"internal":"private"}')).toBe('Actividad registrada en el historial del manifiesto.');
});
it('preserves historical prose and safely handles malformed metadata', () => {
 expect(describe('INCIDENTE','Detención declarada.')).toBe('Detención declarada.');
 expect(describe('PROPUESTA_PARTES_V1','{invalid')).not.toContain('{invalid');
});
it('live feed and playback show the same label while clicks preserve the original event', () => {
 const e={id:'qa-event',tipo:'CERTIFICACION_OPERADOR_V1',descripcion:'metadata',timestamp:'2026-10-23T12:00:00Z',manifiestoNumero:'QA-01'};const click=vi.fn();
 const {container}=render(<><EventFeed mode="LIVE" eventos={[e]} onEventClick={click}/><DepartureBoard event={{...e,eventoTipo:e.tipo,manifiestoId:'qa'}} eventIndex={0} totalEvents={1}/></>);
 expect(screen.getAllByText('Certificación habilitada')).toHaveLength(2);
 expect(container.textContent).not.toContain('CERTIFICACION_OPERADOR_V1');
 fireEvent.click(screen.getByRole('button',{name:/Abrir evento QA-01/})); expect(click).toHaveBeenCalledWith(e);
});
