import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Options } from 'html2canvas';
const mocks = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('html2canvas', () => ({ default: mocks.render }));
import { captureSupportScreen } from '../../services/supportCapture';

describe('on-demand local support viewport capture', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('bounds pixels, crops the visible viewport and frees the raster after encoding', async () => {
    const canvas = { width: 1000, height: 1000, toBlob: (callback: BlobCallback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })) };
    mocks.render.mockResolvedValue(canvas);
    const file = await captureSupportScreen();
    expect(file.type).toBe('image/jpeg'); expect(file.name).toMatch(/^sitrep-pantalla-\d+\.jpg$/);
    const [element, options] = mocks.render.mock.calls[0] as [HTMLElement, Options];
    expect(element).toBe(document.body); expect(options.width).toBe(innerWidth); expect(options.height).toBe(innerHeight);
    expect(Math.max(options.width, options.height) * options.scale).toBeLessThanOrEqual(1600);
    expect(options.scale).toBeLessThanOrEqual(1); expect(options.allowTaint).toBe(false);
    expect(canvas.width).toBe(0); expect(canvas.height).toBe(0);
  });
  it('excludes the help UI and explicit private areas and masks passwords only in the clone', async () => {
    mocks.render.mockResolvedValue({ width: 1, height: 1, toBlob: (callback: BlobCallback) => callback(new Blob(['jpeg'])) });
    await captureSupportScreen();
    const options = mocks.render.mock.calls[0][1] as Options;
    const clone = document.implementation.createHTMLDocument();
    clone.body.innerHTML = '<input type="password" value="secret"><div data-support-ui><button>Ayuda</button></div><section data-support-private>private</section><iframe></iframe><h1>SITREP</h1>';
    options.onclone!(clone, clone.body);
    expect(clone.querySelector<HTMLInputElement>('input')!.value).toBe('');
    expect(clone.querySelector<HTMLInputElement>('input')!.style.visibility).toBe('hidden');
    expect(options.ignoreElements!(clone.querySelector('button')!)).toBe(true);
    expect(options.ignoreElements!(clone.querySelector('section')!)).toBe(true);
    expect(options.ignoreElements!(clone.querySelector('iframe')!)).toBe(true);
    expect(options.ignoreElements!(clone.querySelector('h1')!)).toBe(false);
  });
  it('rejects a failed encoder rather than inventing an image and still frees the canvas', async () => {
    const canvas = { width: 1000, height: 1000, toBlob: (callback: BlobCallback) => callback(null) };
    mocks.render.mockResolvedValue(canvas);
    await expect(captureSupportScreen()).rejects.toThrow('No se pudo crear la captura');
    expect(canvas.width).toBe(0); expect(canvas.height).toBe(0);
  });
});
