import { fileMimeFromBytes, storageKeyPath } from '../../services/documentStorage.service';

describe('private document storage boundaries', () => {
  it('detects bytes instead of trusting declared MIME', () => {
    expect(fileMimeFromBytes(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(fileMimeFromBytes(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  it('rejects traversal and empty storage keys', () => {
    expect(() => storageKeyPath('../secret.pdf')).toThrow();
    expect(() => storageKeyPath('a/../../secret.pdf')).toThrow();
    expect(() => storageKeyPath('')).toThrow();
  });
});
