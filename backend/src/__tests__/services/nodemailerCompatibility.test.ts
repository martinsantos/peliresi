import { describe, expect, it } from 'vitest';
import nodemailer from 'nodemailer';

describe('Nodemailer runtime compatibility (memory transport, no SMTP)', () => {
  it('preserves recipient, reply address, HTML, plain text and links in the compiled message', async () => {
    const transporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    });
    const url = 'https://example.invalid/avisos/qa-requerimiento';
    const html = `<p>QA &lt;inspeccionado&gt;</p><a href="${url}">Responder</a>`;
    const text = `QA <inspeccionado>\nResponder: ${url}`;
    const result = await transporter.sendMail({
      from: 'SITREP <no-reply@example.invalid>',
      to: 'inspeccionado@example.invalid',
      replyTo: 'inspector@example.invalid',
      subject: 'Inspección: respuesta requerida',
      html,
      text,
      textEncoding: 'base64',
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    expect(result.envelope).toEqual({
      from: 'no-reply@example.invalid',
      to: ['inspeccionado@example.invalid'],
    });
    const message = result.message.toString('utf8');
    expect(message).toContain('Reply-To: inspector@example.invalid');
    expect(message).toContain('multipart/alternative');
    expect(message).toContain('text/plain; charset=utf-8');
    expect(message).toContain('text/html; charset=utf-8');
    const body = (kind: 'plain' | 'html') => {
      const part = message.split(/\r?\n--/).find(value => value.includes(`Content-Type: text/${kind};`));
      expect(part).toBeDefined();
      const [headers, ...content] = part!.split(/\r?\n\r?\n/);
      const raw = content.join('\n\n').replace(/\r?\n$/, '');
      expect(headers).toMatch(/Content-Transfer-Encoding: (base64|7bit)/);
      return (/Content-Transfer-Encoding: base64/.test(headers)
        ? Buffer.from(raw.replace(/\s/g, ''), 'base64').toString('utf8')
        : raw).replace(/\r\n/g, '\n');
    };
    expect(body('html')).toBe(html);
    expect(body('plain')).toBe(text);
    expect(result.messageId).toBeTruthy();
    transporter.close();
  });
});
