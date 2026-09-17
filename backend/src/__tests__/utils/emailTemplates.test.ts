import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  renderAlertEmail,
  renderCrudEmail,
  renderReportEmail,
  renderWorkflowActionEmail,
} from '../../utils/emailTemplates';

describe('email templates', () => {
  it('escapes user-controlled text', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders a designed alert with a safe map card', () => {
    const html = renderAlertEmail({
      title: 'Desvio de ruta',
      message: '<mensaje>',
      manifestNumber: '2026-000001',
      manifestId: 'm-1',
      map: { lat: -32.889, lng: -68.845, label: 'Planta <Norte>', address: 'Ruta 7' },
      frontendUrl: 'https://sitrep.ultimamilla.com.ar',
    });

    expect(html).toContain('Abrir mapa');
    expect(html).toContain('2026-000001');
    expect(html).toContain('https://www.google.com/maps/search/');
    expect(html).toContain('&lt;mensaje&gt;');
    expect(html).not.toContain('<mensaje>');
  });

  it('omits an invalid map instead of emitting an unsafe link', () => {
    const html = renderWorkflowActionEmail({
      title: 'Accion',
      message: 'Cambio realizado',
      action: 'ENTREGADO',
      map: { lat: 999, lng: 0, url: 'javascript:alert(1)' },
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Abrir mapa');
  });

  it('renders ABM and report variants with their metadata', () => {
    const crud = renderCrudEmail({
      title: 'Actor actualizado',
      message: 'Se modificaron los datos.',
      operation: 'Modificacion',
      entity: 'Generador',
      recordName: 'Planta Norte',
      fields: [{ label: 'CUIT', value: '30-123' }],
    });
    const report = renderReportEmail({
      title: 'Informe listo',
      message: 'El informe esta disponible.',
      reportName: 'Manifiestos tratados',
      period: '01/08/2026 - 09/08/2026',
      rows: 12,
      downloadUrl: 'https://sitrep.ultimamilla.com.ar/api/reportes/exportar/manifiestos',
    });

    expect(crud).toContain('ABM');
    expect(crud).toContain('Planta Norte');
    expect(report).toContain('Informe listo');
    expect(report).toContain('Descargar informe');
    expect(report).toContain('12');
  });
});
