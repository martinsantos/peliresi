import { afterEach, describe, expect, it, vi } from 'vitest';
import { mailPolicy, mendozaDayStart, retryableSmtpFailure } from '../../services/email-policy';
import { mailLink, mailText, renderMail, renderDigest, type MailTemplateId } from '../../services/email-templates';

afterEach(() => vi.unstubAllEnvs());
describe('mail template catalogue', () => {
  it.each<MailTemplateId>(['verify', 'pending', 'approved', 'newAccount', 'reset', 'application', 'observed', 'response', 'rejected', 'modification', 'modificationApproved', 'modificationRejected'])('%s has useful safe HTML, text and no interpolated subject', id => {
    const mail = renderMail(id, { name: '<img src=x onerror=bad>', role: '<admin>', message: '<script>bad()</script>\nCorregir domicilio', token: 'a"&b#c' });
    expect(mail.version).toBe('20261012.3');
    expect(mail.html).toContain('lang="es"');
    expect(mail.html.match(/<img /g)).toHaveLength(2);
    expect(mail.html).toContain('alt="Gobierno de Mendoza"');
    expect(mail.html).toContain('/mendoza-marca-horizontal-transparente.png');
    expect(mail.html).toContain('/mail-sitrep-rotonda.png');
    expect(mail.html).not.toContain('/icon-192.png');
    expect(mail.html).toContain('data-mail-masthead');
    expect(mail.html).toContain('data-mail-brand');
    expect(mail.text).toContain('SITREP');
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('<script');
    expect(mail.html).toContain('&lt;admin&gt;');
    expect(mail.text).toContain('Corregir domicilio');
    expect(mail.subject).not.toContain('onerror');
    if (id === 'verify' || id === 'reset') expect(mail.html).toContain('token=a%22%26b%23c');
  });
  it.each<MailTemplateId>(['verify', 'pending', 'newAccount', 'reset', 'application', 'observed', 'rejected', 'modification', 'modificationRejected'])('%s rejects missing required data', id => {
    expect(() => renderMail(id, { name: 'QA' })).toThrow('MAIL_FIELDS_REQUIRED');
  });
  it('rejects absent name instead of rendering undefined', () => {
    expect(() => renderMail('approved', { name: '' })).toThrow();
  });
  it('keeps the institutional identity and action when a mail client strips images', () => {
    const mail = renderMail('approved', { name: 'QA' });
    const withoutImages = mailText(mail.html.replace(/<img\b[^>]*>/gi, ''));
    expect(withoutImages).toContain('Gobierno de Mendoza');
    expect(withoutImages).toContain('SITREP');
    expect(withoutImages).toContain('Ingresar a SITREP (https://sitrep.ultimamilla.com.ar/login)');
  });
  it('separates paragraph starts from preceding institutional text in plain-text mail', () => {
    expect(mailText('Fiscalización Ambiental<p>Este aviso informativo</p>')).toBe('Fiscalización Ambiental\nEste aviso informativo');
  });
  it('lets a verified pending applicant continue the application without claiming operational access', () => {
    const mail = renderMail('pending', { name: 'QA', role: 'Generador' });
    expect(mail.html).toContain('Continuar mi inscripción');
    expect(mail.html).toContain('/mi-solicitud');
    expect(mail.text).toContain('Las funciones operativas se habilitan después de la aprobación');
    expect(mail.text).not.toContain('antes de habilitar el ingreso');
  });
  it.each(['//attacker.invalid', 'https://attacker.invalid', 'javascript:alert(1)', '/\\attacker.invalid'])('rejects nonlocal action %s', path => {
    expect(() => mailLink(path)).toThrow();
  });
  it('does not accept an insecure external origin or embedded credentials', () => {
    expect(() => mailLink('/login', 'http://example.invalid')).toThrow();
    expect(() => mailLink('/login', 'https://user:pass@example.invalid')).toThrow();
  });
  it('escapes digest titles and links back to the alert repository', () => {
    const html = renderDigest([{ subject: '<svg onload=bad>', html: 'Revisar' }]);
    expect(html).not.toContain('<svg');
    expect(html).toContain('/alertas');
  });
});
describe('activation and retry policy', () => {
  const now = new Date('2026-10-11T15:00:00Z');
  it.each([undefined, '', 'true', 'FALSE'])('defaults to disabled for %s', flag => {
    expect(mailPolicy({ DISABLE_EMAILS: flag, EMAIL_DELIVERY_NOT_BEFORE: '2026-10-11T14:55:00Z' }, now).enabled).toBe(false);
  });
  it.each(['', 'yesterday', '2026-10-11', '2026-10-11T14:00:00', '2026-10-12T00:00:00Z'])('does not activate without an explicit valid elapsed cutoff: %s', cutoff => {
    expect(mailPolicy({ DISABLE_EMAILS: 'false', EMAIL_DELIVERY_NOT_BEFORE: cutoff }, now).enabled).toBe(false);
  });
  it('takes the later of activation cutoff and freshness window', () => {
    expect(mailPolicy({ DISABLE_EMAILS: 'false', EMAIL_DELIVERY_NOT_BEFORE: '2026-10-11T14:55:00Z' }, now).notBefore.toISOString()).toBe('2026-10-11T14:55:00.000Z');
    expect(mailPolicy({ DISABLE_EMAILS: 'false', EMAIL_DELIVERY_NOT_BEFORE: '2026-10-10T14:55:00Z' }, now).notBefore.toISOString()).toBe('2026-10-11T14:30:00.000Z');
  });
  it('resets limits at midnight Mendoza rather than host midnight', () => {
    expect(mendozaDayStart(new Date('2026-10-11T02:59:59Z')).toISOString()).toBe('2026-10-10T03:00:00.000Z');
    expect(mendozaDayStart(new Date('2026-10-11T03:00:00Z')).toISOString()).toBe('2026-10-11T03:00:00.000Z');
  });
  it('does not retry ambiguous timeout, reset or permanent rejection', () => {
    for (const error of [{ code: 'ETIMEDOUT' }, { code: 'ECONNRESET' }, { responseCode: 550 }, null]) expect(retryableSmtpFailure(error)).toBe(false);
    expect(retryableSmtpFailure({ responseCode: 451 })).toBe(true);
    expect(retryableSmtpFailure({ code: 'ECONNECTION' })).toBe(true);
  });
});
