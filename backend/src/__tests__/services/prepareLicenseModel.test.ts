import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ stat: vi.fn(), mkdir: vi.fn(), read: vi.fn(), rename: vi.fn(), unlink: vi.fn(), write: vi.fn(), verify: vi.fn(), fetch: vi.fn() }));
vi.mock('node:fs/promises', () => ({ lstat: m.stat, mkdir: m.mkdir, readFile: m.read, rename: m.rename, unlink: m.unlink, writeFile: m.write }));
vi.mock('../../domain/licenseModel', () => ({ LICENSE_MODEL: { url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/pinned/spa.traineddata', bytes: 3 }, verifyLicenseModel: m.verify }));
import { prepareLicenseModel } from '../../scripts/prepareLicenseModel';
afterEach(() => { vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', m.fetch);
  m.stat.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }));
  m.mkdir.mockResolvedValue(undefined); m.read.mockResolvedValue(Buffer.from('QA!'));
  m.write.mockResolvedValue(undefined); m.rename.mockResolvedValue(undefined); m.unlink.mockResolvedValue(undefined);
  m.verify.mockImplementation(() => undefined);
  m.fetch.mockImplementation(async () => ({ ok: true, body: { async *[Symbol.asyncIterator]() { yield Buffer.from('QA!'); }, cancel: vi.fn().mockResolvedValue(undefined) } }));
});
it('downloads only the pinned public model during build and verifies bytes before atomic placement', async () => {
  await prepareLicenseModel();
  expect(m.fetch).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/raw\.githubusercontent\.com\/tesseract-ocr\//), expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
  expect(m.verify).toHaveBeenCalledWith(Buffer.from('QA!'));
  expect(m.verify.mock.invocationCallOrder[0]).toBeLessThan(m.write.mock.invocationCallOrder[0]);
  expect(m.write).toHaveBeenCalledWith(expect.stringMatching(/spa-[\da-f-]+\.partial$/), Buffer.from('QA!'), { flag: 'wx', mode: 0o644 });
  expect(m.rename).toHaveBeenCalledWith(expect.stringMatching(/\.partial$/), expect.stringMatching(/assets\/ocr\/spa\.traineddata$/));
});
it('reuses a verified existing build asset without any network request', async () => {
  m.stat.mockResolvedValue({ isFile: () => true, isSymbolicLink: () => false, size: 3 });
  await prepareLicenseModel(); expect(m.verify).toHaveBeenCalledOnce(); expect(m.fetch).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
});
it.each(['symlink', 'size', 'hash'])('fails closed for an existing asset with invalid %s instead of overwriting it', async issue => {
  m.stat.mockResolvedValue({ isFile: () => true, isSymbolicLink: () => issue === 'symlink', size: issue === 'size' ? 4 : 3 });
  if (issue === 'hash') m.verify.mockImplementation(() => { throw new Error('LICENSE_MODEL_INTEGRITY'); });
  await expect(prepareLicenseModel()).rejects.toThrow('LICENSE_MODEL_INTEGRITY');
  expect(m.fetch).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
});
it('rejects oversized streamed downloads and changed digests before writing any model', async () => {
  m.fetch.mockResolvedValue({ ok: true, body: { async *[Symbol.asyncIterator]() { yield Buffer.from('TOO LARGE'); }, cancel: vi.fn().mockResolvedValue(undefined) } });
  await expect(prepareLicenseModel()).rejects.toThrow('LICENSE_MODEL_INTEGRITY'); expect(m.write).not.toHaveBeenCalled();
  m.fetch.mockImplementation(async () => ({ ok: true, body: { async *[Symbol.asyncIterator]() { yield Buffer.from('QA!'); }, cancel: vi.fn().mockResolvedValue(undefined) } }));
  m.verify.mockImplementation(() => { throw new Error('LICENSE_MODEL_INTEGRITY'); });
  await expect(prepareLicenseModel()).rejects.toThrow('LICENSE_MODEL_INTEGRITY'); expect(m.write).not.toHaveBeenCalled();
});
it('never hides a placement failure and removes only its own partial asset', async () => {
  m.rename.mockRejectedValue(new Error('BUILD_READONLY'));
  await expect(prepareLicenseModel()).rejects.toThrow('BUILD_READONLY');
  expect(m.unlink).toHaveBeenCalledWith(expect.stringMatching(/spa-[\da-f-]+\.partial$/));
});
