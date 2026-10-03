import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DashboardPanels } from '../../pages/monitor/components/DashboardPanels';
import { FloatingPanelLayer, type ManifiestoFPData } from '../../pages/monitor/components/FloatingPanelLayer';

const event: ManifiestoFPData = { timestamp: '2026-10-03T01:00:00Z', eventoTipo: 'CREACION', manifiestoNumero: 'QA-READ',
  descripcion: 'Evento sintético de lectura', generador: { razonSocial: 'QA Origen' },
  transportista: 'QA Transporte', operador: { razonSocial: 'QA Destino' } };
function floating(data = event) {
  return render(<FloatingPanelLayer panels={[{ id: 'read', type: 'manifiesto', data, pos: { x: 12, y: 12 }, zIndex: 1100, minimized: false }]}
    onClose={vi.fn()} onBringToFront={vi.fn()} onMove={vi.fn()} onMinimize={vi.fn()} />);
}
function sidebar(data = event) {
  return render(<MemoryRouter><DashboardPanels mode="PLAYBACK" liveData={null} forecastData={null}
    currentEvent={data} currentEventIndex={0} totalEventCount={55} /></MemoryRouter>);
}
const luminance = (rgb: number[]) => rgb.map(channel => {
  const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}).reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0);
function contrast(color: string, background: string) {
  const fg = color.match(/[\d.]+/g)!.map(Number), bg = background.match(/[\d.]+/g)!.map(Number);
  const alpha = bg[3] ?? 1;
  const opaqueBackground = bg.slice(0, 3).map(channel => channel * alpha + 255 * (1 - alpha));
  const a = luminance(fg.slice(0, 3)), b = luminance(opaqueBackground);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
beforeEach(() => localStorage.clear()); afterEach(cleanup);
it('event names use a readable foreground for every event tint, in both detail surfaces', () => {
  for (const kind of ['CREACION', 'FIRMA', 'RETIRO', 'ENTREGA', 'RECEPCION', 'TRATAMIENTO', 'CIERRE']) {
    for (const open of [floating, sidebar]) {
      const view = open({ ...event, eventoTipo: kind });
      const badge = screen.getByText(kind, { exact: true });
      // Inline palette belongs to the component; the neutral foreground contract
      // is asserted here, and computed CSS contrast is measured in cloud E2E.
      const color = badge.style.color || (badge.classList.contains('text-neutral-800') ? 'rgb(38, 38, 38)' : 'rgb(0, 0, 0)');
      expect(contrast(color, badge.style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      expect(badge).toHaveClass('text-neutral-800');
      view.unmount();
    }
  }
});
it('the real event position is not rendered as faint decorative text', () => {
  sidebar(); expect(screen.getByText('1/55', { exact: true })).toHaveClass('text-neutral-600');
});
it('actor categories use the same three icons and explicit names in both detail surfaces', () => {
  for (const open of [floating, sidebar]) {
    const view = open(); const actors = screen.getByRole('list', { name: 'Actores del evento', exact: true });
    for (const [category, glyph] of [['Generador', 'factory'], ['Transportista', 'truck'], ['Operador', 'flask-conical']]) {
      const row = within(actors).getByText(category, { exact: true }).closest('li')!;
      expect(row.querySelector('svg.lucide-' + glyph)).not.toBeNull();
      expect(row.textContent).toContain(category === 'Generador' ? 'QA Origen' : category === 'Operador' ? 'QA Destino' : 'QA Transporte');
    }
    view.unmount();
  }
});
it('the historical progression names its event scope and keeps future stages readable', () => {
  floating();
  expect(screen.getByText('Etapa del evento: Borrador', { exact: true })).toBeVisible();
  const stages = screen.getByRole('list', { name: 'Etapas hasta este evento', exact: true });
  const rows = within(stages).getAllByRole('listitem'); expect(rows).toHaveLength(7);
  expect(rows[0]).toHaveAttribute('aria-current', 'step');
  for (const row of rows) expect(row.querySelector('span')).toHaveClass('text-neutral-600');
  expect(rows[1]).not.toHaveAttribute('aria-current');
});
