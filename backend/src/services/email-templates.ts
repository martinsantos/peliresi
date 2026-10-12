export const MAIL_TEMPLATE_VERSION = '20261012.4';
export function escapeMail(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
export function mailLink(path: string, origin = process.env.FRONTEND_URL || 'https://sitrep.ultimamilla.com.ar'): string {
  const base = new URL(origin);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('MAIL_ORIGIN_INVALID');
  if (base.username || base.password || !path.startsWith('/') || path.startsWith('//')) throw new Error('MAIL_LINK_INVALID');
  const target = new URL(path, base);
  if (target.origin !== base.origin) throw new Error('MAIL_LINK_INVALID');
  return target.href;
}

/** Conversion of our controlled HTML only; not a general-purpose HTML sanitizer. */
export function mailText(html: string): string {
  return html.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/?(?:p|h[1-6]|div|li|ul|td|tr)\b[^>]*>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity]!))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}

export function mailShell(content: string): string {
  const logo = escapeMail(mailLink('/mendoza-marca-horizontal-transparente.png'));
  const brand = escapeMail(mailLink('/mail-sitrep-rotonda.png'));
  return `<!doctype html><!-- SITREP mail template ${MAIL_TEMPLATE_VERSION} --><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f3f6f4;color:#172c24;font:16px/1.55 Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#172c24"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce5df;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#172c24">
<tr data-mail-header-row>
<td data-mail-masthead width="50%" align="left" valign="middle" style="width:50%;padding:20px 16px;border-bottom:3px solid #174a7e;border-radius:10px 0 0 0"><img src="${logo}" width="112" height="36" alt="Gobierno de Mendoza" style="display:block;width:112px;height:36px;color:#174a7e;font-size:12px"><p style="margin:10px 0 0;color:#174a7e;font-size:12px;line-height:17px"><strong data-mail-institution>Gobierno de Mendoza</strong></p><p style="margin:3px 0 0;color:#526359;font-size:12px;line-height:17px">Dirección General de<br>Fiscalización Ambiental</p></td>
<td data-mail-brand width="50%" align="right" valign="middle" bgcolor="#1B5E3C" style="width:50%;background:#1B5E3C;padding:20px 16px;border-bottom:3px solid #0D8A4F;border-radius:0 10px 0 0"><table role="presentation" align="right" cellspacing="0" cellpadding="0" style="font-family:Arial,Helvetica,sans-serif;color:#ffffff"><tr><td width="34" valign="middle" style="width:34px;padding-right:6px"><img src="${brand}" width="28" height="28" alt="" role="presentation" style="display:block;width:28px;height:28px;border:0"></td><td valign="middle"><p data-mail-wordmark style="margin:0;color:#ffffff;font-family:Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:30px">SITREP</p></td></tr><tr><td colspan="2" align="right"><p style="margin:10px 0 0;color:#ffffff;font-size:12px;line-height:17px">Trazabilidad de<br>Residuos Peligrosos</p></td></tr></table></td>
</tr><!-- mail-header-end -->
<tr><td colspan="2" style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#172c24;overflow-wrap:anywhere">${content}</td></tr>
<tr><td colspan="2" style="padding:20px 24px;border-top:1px solid #dce5df;font-size:12px;line-height:1.6;color:#526359">Provincia de Mendoza<br>Dirección General de Fiscalización Ambiental<p style="margin:12px 0 0">Este aviso informativo no reemplaza las notificaciones formales del trámite.</p></td></tr>
</table></td></tr></table></body></html>`;
}

export function mailAction(path: string, label: string): string {
  return `<p style="margin:24px 0 8px"><a href="${escapeMail(mailLink(path))}" style="display:inline-block;padding:12px 20px;background:#1B5E3C;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;line-height:24px">${escapeMail(label)}</a></p>`;
}

export type MailTemplateId = 'verify' | 'pending' | 'approved' | 'newAccount' | 'reset' | 'application' | 'observed' | 'response' | 'rejected' | 'modification' | 'modificationApproved' | 'modificationRejected';
type Fields = { name: string; role?: string; message?: string; token?: string };
type Spec = { title: string; body: string; action?: string; path?: string; required?: 'role' | 'message' | 'token' };
const specs: Record<MailTemplateId, Spec> = {
  verify: { title: 'Verificá tu cuenta', body: 'Confirmá tu dirección de correo para continuar. El enlace vence en 24 horas. Si no solicitaste el registro, ignorá este mensaje.', action: 'Verificar correo', path: '/verificar-email', required: 'token' },
  pending: { title: 'Cuenta pendiente de aprobación', body: 'Tu correo fue verificado. Podés ingresar para completar y seguir tu inscripción. Las funciones operativas se habilitan después de la aprobación.', action: 'Continuar mi inscripción', path: '/mi-solicitud', required: 'role' },
  approved: { title: 'Tu cuenta está activa', body: 'Ya podés ingresar a SITREP con tu cuenta.', action: 'Ingresar a SITREP', path: '/login' },
  newAccount: { title: 'Registro pendiente de revisión', body: 'Hay una cuenta nueva para revisar.', action: 'Revisar usuarios', path: '/admin/usuarios', required: 'role' },
  reset: { title: 'Restablecer contraseña', body: 'Recibimos una solicitud de recuperación. El enlace vence en una hora. Si no lo solicitaste, ignorá este mensaje.', action: 'Restablecer contraseña', path: '/reset-password', required: 'token' },
  application: { title: 'Nueva solicitud de inscripción', body: 'Hay una solicitud presentada para revisar.', action: 'Revisar solicitudes', path: '/admin/solicitudes', required: 'role' },
  observed: { title: 'Tu solicitud necesita una corrección', body: 'Revisá la observación y respondé desde SITREP.', action: 'Ver mi solicitud', path: '/mi-solicitud', required: 'message' },
  response: { title: 'Respuesta a una observación', body: 'El solicitante respondió. La información está disponible para tu revisión.', action: 'Revisar solicitudes', path: '/admin/solicitudes' },
  rejected: { title: 'Solicitud de inscripción rechazada', body: 'La administración resolvió tu solicitud. Si necesitás aclaraciones, consultá a la DGFA.', required: 'message' },
  modification: { title: 'Modificación de datos solicitada', body: 'Un actor solicita una modificación de sus datos.', action: 'Revisar modificaciones', path: '/admin/renovaciones', required: 'role' },
  modificationApproved: { title: 'Modificación de datos aprobada', body: 'Los cambios aprobados ya están disponibles en SITREP.', action: 'Ingresar a SITREP', path: '/login' },
  modificationRejected: { title: 'Modificación de datos rechazada', body: 'Revisá el motivo de la resolución. Podés consultar a la DGFA si necesitás aclaraciones.', required: 'message' },
};
export function renderMail(id: MailTemplateId, fields: Fields): { subject: string; html: string; text: string; version: string } {
  const spec = specs[id];
  if (!fields.name?.trim() || (spec.required && !fields[spec.required]?.trim())) throw new Error(`MAIL_FIELDS_REQUIRED:${id}`);
  const link = spec.path ? mailLink(spec.path + (spec.required === 'token' ? '?token=' + encodeURIComponent(fields.token!) : '')) : '';
  const content = `<h1 style="font-size:22px;line-height:1.3;color:#1B5E3C;margin:0 0 16px">${spec.title}</h1>
<p>${escapeMail(fields.name)}</p><p>${spec.body}</p>
${fields.role ? `<p>Perfil: <strong>${escapeMail(fields.role)}</strong></p>` : ''}
${fields.message ? `<p style="white-space:pre-wrap;border-left:3px solid #1B5E3C;padding:12px">${escapeMail(fields.message)}</p>` : ''}
${link ? `<p><a href="${escapeMail(link)}" style="display:inline-block;padding:12px 20px;background:#1B5E3C;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">${spec.action}</a></p><p style="font-size:12px;word-break:break-all">${escapeMail(link)}</p>` : ''}`;
  const html = mailShell(content);
  return { subject: '[SITREP] ' + spec.title, html, text: mailText(html), version: MAIL_TEMPLATE_VERSION };
}

export function renderDigest(items: { subject: string; html: string }[]): string {
  return mailShell(`<h1 style="font-size:22px;color:#1B5E3C">Resumen de alertas</h1><ul>${items.map(item => `<li style="margin-bottom:16px"><strong>${escapeMail(item.subject)}</strong><p>${escapeMail(mailText(item.html))}</p></li>`).join('')}</ul>${mailAction('/alertas', 'Revisar alertas en SITREP')}`);
}
