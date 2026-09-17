export type EmailTone = 'success' | 'info' | 'warning' | 'danger';

export interface EmailMap {
  lat: number;
  lng: number;
  label?: string | null;
  address?: string | null;
  url?: string | null;
}

export interface EmailCta {
  label: string;
  url: string;
}

export interface EmailField {
  label: string;
  value: string | number | null | undefined;
}

const toneColors: Record<EmailTone, { accent: string; soft: string; text: string }> = {
  success: { accent: '#16834b', soft: '#e8f7ef', text: '#105c35' },
  info: { accent: '#1769aa', soft: '#eaf4fc', text: '#124e7d' },
  warning: { accent: '#b86b00', soft: '#fff5df', text: '#7a4700' },
  danger: { accent: '#bd3030', soft: '#fff0f0', text: '#8f2020' },
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizedMap(map?: EmailMap | null): (EmailMap & { url: string }) | null {
  if (!map || !Number.isFinite(map.lat) || !Number.isFinite(map.lng)) return null;
  if (map.lat < -90 || map.lat > 90 || map.lng < -180 || map.lng > 180) return null;
  const url = safeUrl(map.url || '') ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${map.lat},${map.lng}`)}`;
  return { ...map, url };
}

export function renderMapCard(map?: EmailMap | null): string {
  const normalized = normalizedMap(map);
  if (!normalized) return '';
  const coordinates = `${normalized.lat.toFixed(6)}, ${normalized.lng.toFixed(6)}`;
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #cfe4d8;border-radius:12px;background:#eef9f2;overflow:hidden">
      <tr><td style="padding:16px 18px 8px">
        <p style="margin:0 0 6px;color:#1b5e3c;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Ubicacion</p>
        <p style="margin:0;color:#173b2a;font-size:16px;font-weight:700">&#128205; ${escapeHtml(normalized.label || 'Punto registrado')}</p>
        ${normalized.address ? `<p style="margin:5px 0 0;color:#567064;font-size:13px">${escapeHtml(normalized.address)}</p>` : ''}
      </td></tr>
      <tr><td style="padding:10px 18px 16px">
        <p style="margin:0 0 12px;color:#567064;font-family:monospace;font-size:13px">${escapeHtml(coordinates)}</p>
        <a href="${escapeHtml(normalized.url)}" target="_blank" rel="noopener" style="display:inline-block;background:#1b5e3c;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Abrir mapa</a>
      </td></tr>
    </table>`;
}

export function renderFields(fields: EmailField[]): string {
  const visible = fields.filter((field) => field.value !== null && field.value !== undefined && field.value !== '');
  if (visible.length === 0) return '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-collapse:collapse">
    ${visible.map((field) => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #edf1ef;color:#6c8176;font-size:13px;width:38%">${escapeHtml(field.label)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #edf1ef;color:#20392b;font-size:14px;font-weight:600">${escapeHtml(field.value)}</td>
    </tr>`).join('')}
  </table>`;
}

export function renderEmailLayout(options: {
  contentHtml: string;
  title?: string;
  preheader?: string;
  eyebrow?: string;
  tone?: EmailTone;
  cta?: EmailCta | null;
  map?: EmailMap | null;
  frontendUrl?: string;
}): string {
  const tone = toneColors[options.tone || 'info'];
  const frontendUrl = safeUrl(options.frontendUrl || '') || 'https://sitrep.ultimamilla.com.ar';
  const ctaUrl = options.cta ? safeUrl(options.cta.url) : null;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title || 'SITREP')}</title></head>
<body style="margin:0;background:#eef3f0;color:#20392b;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader || options.title || 'Notificacion de SITREP')}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f0;padding:24px 10px">
    <tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #dfe9e3;border-radius:16px;overflow:hidden">
      <tr><td style="background:#1b5e3c;padding:22px 28px;color:#fff">
        <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.82">Provincia de Mendoza</p>
        <p style="margin:8px 0 0;font-size:22px;font-weight:800;letter-spacing:-.02em">SITREP</p>
        <p style="margin:4px 0 0;font-size:12px;opacity:.86">Sistema de Trazabilidad de Residuos Peligrosos</p>
      </td></tr>
      <tr><td style="height:5px;background:${tone.accent}"></td></tr>
      <tr><td style="padding:30px 30px 26px">
        ${options.eyebrow ? `<p style="margin:0 0 8px;color:${tone.text};font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${escapeHtml(options.eyebrow)}</p>` : ''}
        ${options.title ? `<h1 style="margin:0 0 16px;color:#173b2a;font-size:25px;line-height:1.2;letter-spacing:-.02em">${escapeHtml(options.title)}</h1>` : ''}
        ${options.contentHtml}
        ${renderMapCard(options.map)}
        ${ctaUrl && options.cta ? `<p style="margin:26px 0 4px;text-align:center"><a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener" style="display:inline-block;background:${tone.accent};color:#fff;padding:13px 22px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(options.cta.label)}</a></p>` : ''}
      </td></tr>
      <tr><td style="padding:18px 30px;background:#f7faf8;border-top:1px solid #e4eee8">
        <p style="margin:0;color:#6c8176;font-size:12px;line-height:1.55">Este mensaje fue generado por SITREP. Para ingresar, utiliza el <a href="${escapeHtml(frontendUrl)}" style="color:#1b5e3c;font-weight:700">portal web</a>.</p>
        <p style="margin:8px 0 0;color:#91a39a;font-size:11px">Direccion General de Fiscalizacion Ambiental — Provincia de Mendoza</p>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>`;
}

export function renderAlertEmail(options: {
  title: string;
  message: string;
  manifestNumber?: string | null;
  manifestId?: string | null;
  severity?: EmailTone;
  details?: EmailField[];
  map?: EmailMap | null;
  frontendUrl?: string;
}): string {
  const link = options.manifestId && safeUrl(options.frontendUrl || '')
    ? `${options.frontendUrl!.replace(/\/$/, '')}/manifiestos/${encodeURIComponent(options.manifestId)}`
    : options.frontendUrl || 'https://sitrep.ultimamilla.com.ar/alertas';
  return renderEmailLayout({
    title: options.title,
    eyebrow: options.severity === 'danger' ? 'Alerta critica' : 'Aviso operativo',
    preheader: options.message,
    tone: options.severity || 'warning',
    frontendUrl: options.frontendUrl,
    cta: { label: options.manifestId ? 'Ver manifiesto' : 'Ver alertas', url: link },
    map: options.map,
    contentHtml: renderAlertCard(options),
  });
}

/** Compact variant used inside an alert digest (no nested document/layout). */
export function renderAlertCard(options: {
  title: string;
  message: string;
  manifestNumber?: string | null;
  details?: EmailField[];
}): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.6">${escapeHtml(options.message)}</p>
    ${options.manifestNumber ? `<p style="margin:0 0 10px;color:#567064;font-size:13px">Manifiesto <strong>${escapeHtml(options.manifestNumber)}</strong></p>` : ''}
    ${renderFields(options.details || [])}`;
}

export function renderWorkflowActionEmail(options: {
  title: string;
  message: string;
  action: string;
  manifestNumber?: string | null;
  manifestId?: string | null;
  actor?: string | null;
  map?: EmailMap | null;
  frontendUrl?: string;
}): string {
  return renderEmailLayout({
    title: options.title,
    eyebrow: 'Accion del servicio',
    preheader: options.message,
    tone: 'info',
    frontendUrl: options.frontendUrl,
    cta: options.manifestId ? { label: 'Abrir seguimiento', url: `${(options.frontendUrl || 'https://sitrep.ultimamilla.com.ar').replace(/\/$/, '')}/manifiestos/${encodeURIComponent(options.manifestId)}` } : null,
    map: options.map,
    contentHtml: `<p style="margin:0 0 14px;font-size:16px;line-height:1.6">${escapeHtml(options.message)}</p>${renderFields([
      { label: 'Accion', value: options.action },
      { label: 'Manifiesto', value: options.manifestNumber },
      { label: 'Responsable', value: options.actor },
    ])}`,
  });
}

export function renderCrudEmail(options: {
  title: string;
  message: string;
  operation: 'Alta' | 'Baja' | 'Modificacion' | string;
  entity: string;
  recordName?: string | null;
  fields?: EmailField[];
  url?: string | null;
  frontendUrl?: string;
}): string {
  return renderEmailLayout({
    title: options.title,
    eyebrow: `ABM · ${options.operation}`,
    preheader: options.message,
    tone: options.operation === 'Baja' ? 'danger' : options.operation === 'Alta' ? 'success' : 'info',
    frontendUrl: options.frontendUrl,
    cta: options.url ? { label: `Ver ${options.entity.toLowerCase()}`, url: options.url } : null,
    contentHtml: `<p style="margin:0 0 14px;font-size:16px;line-height:1.6">${escapeHtml(options.message)}</p>${renderFields([
      { label: 'Entidad', value: options.entity },
      { label: 'Registro', value: options.recordName },
      ...(options.fields || []),
    ])}`,
  });
}

export function renderReportEmail(options: {
  title: string;
  message: string;
  reportName: string;
  period?: string | null;
  rows?: number | null;
  downloadUrl?: string | null;
  map?: EmailMap | null;
  frontendUrl?: string;
}): string {
  return renderEmailLayout({
    title: options.title,
    eyebrow: 'Informe listo',
    preheader: options.message,
    tone: 'success',
    frontendUrl: options.frontendUrl,
    cta: options.downloadUrl ? { label: 'Descargar informe', url: options.downloadUrl } : { label: 'Abrir reportes', url: `${(options.frontendUrl || 'https://sitrep.ultimamilla.com.ar').replace(/\/$/, '')}/reportes` },
    map: options.map,
    contentHtml: `<p style="margin:0 0 14px;font-size:16px;line-height:1.6">${escapeHtml(options.message)}</p>${renderFields([
      { label: 'Informe', value: options.reportName },
      { label: 'Periodo', value: options.period },
      { label: 'Registros', value: options.rows },
    ])}`,
  });
}
