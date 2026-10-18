import { describe, expect, it } from 'vitest';
import { supportFileType, describeSupportFile, resolveSupportFile, SUPPORT_FILE_LIMIT } from '../../services/supportFile.service';
describe('private support files', () => {
  it('accepts bounded audio containers based on bytes and rejects video renamed to audio', () => {
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm A_OPUS QA')]);
    expect(supportFileType(webm)).toEqual({ mime: 'audio/webm', extension: 'webm' });
    expect(supportFileType(Buffer.from('OggS0000OpusHeadQA'))).toEqual({ mime: 'audio/ogg', extension: 'ogg' });
    expect(supportFileType(Buffer.from('RIFF1234WAVEfmt dataQA'))).toEqual({ mime: 'audio/wav', extension: 'wav' });
    const mp4 = Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from('ftypisom0000moovhdlr0000sounQA')]);
    expect(supportFileType(mp4)).toEqual({ mime: 'audio/mp4', extension: 'm4a' });
    for (const video of [Buffer.concat([webm, Buffer.from('V_VP9')]), Buffer.concat([mp4, Buffer.from('vide')]), Buffer.from('OggS0000theoraQA')]) expect(() => supportFileType(video)).toThrow();
    expect(resolveSupportFile('soporte/12345678-1234-1234-1234-123456789abc.webm')).toMatch(/\.webm$/);
  });
  it.each([
    [Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'],
    [Buffer.from([255,216,255,0]), 'image/jpeg'],
    [Buffer.from('RIFF1234WEBP'), 'image/webp'],
    [Buffer.from('%PDF-1.7'), 'application/pdf'],
  ])('detects actual bytes rather than the claimed MIME', (bytes, expected) => {
    expect(supportFileType(bytes as Buffer).mime).toBe(expected);
  });
  it('rejects active HTML/SVG content, empty files and excessive size', () => {
    for (const buffer of [Buffer.from('<svg onload="alert(1)">'), Buffer.from('MZexecutable'), Buffer.alloc(0), Buffer.alloc(SUPPORT_FILE_LIMIT + 1)]) expect(() => supportFileType(buffer)).toThrow();
  });
  it('allows only server-generated paths below its own support directory', () => {
    expect(resolveSupportFile('soporte/12345678-1234-1234-1234-123456789abc.png')).toMatch(/soporte\/12345678-1234-1234-1234-123456789abc.png$/);
    for (const key of ['../private.env', '/etc/passwd', 'soporte/../../secrets.pdf', 'inspecciones/123.pdf', 'soporte/file.svg']) expect(() => resolveSupportFile(key)).toThrow();
  });
  it('sanitizes original names and hashes exactly the received content', () => {
    const result = describeSupportFile({ buffer: Buffer.from('%PDF-1.7'), originalname: '../../password\n.pdf', mimetype: 'text/html' } as Express.Multer.File);
    expect(result.nombre).toBe('password.pdf'); expect(result.mime).toBe('application/pdf'); expect(result.sha256).toHaveLength(64); expect(result.bytes).toBe(8);
  });
});
