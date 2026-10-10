import { describe, expect, it } from 'vitest';
import { adaptiveLicensePixels, confidentLicenseText, mergeLicenseText } from '../../domain/licenseOcr';
import { licenseFields } from '../../domain/licenseReading';
import { LICENSE_MODEL, verifyLicenseModel } from '../../domain/licenseModel';

const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
function tsv(lines: Array<Array<[string, number]>>) {
  return [header, ...lines.flatMap((words, line) => words.map(([word, confidence], index) =>
    ['5', '1', '1', '1', String(line + 1), String(index + 1), '0', '0', '10', '10', String(confidence), word].join('\t')))].join('\n');
}

describe('license OCR retains only useful proposals, not apparent engine success', () => {
  it('groups actual TSV lines and reads provincial DU/captions, without license/control invention', () => {
    const text = confidentLicenseText(tsv([
      [['D.U.', 91], ['90012345', 96]], [['PEREZ,', 92], ['ANA', 96], ['QA', 89]],
      [['¿', 12], ['DOCUMENTO,', 95], ['APELLIDO', 97], ['Y', 97], ['NOMBRE', 97]],
      [['N°', 95], ['DE', 95], ['CONTROL', 90], ['87654321', 98]],
    ]));
    expect(licenseFields(mergeLicenseText([text]))).toEqual({ dni: '90012345', apellido: 'PEREZ', nombre: 'ANA QA' });
  });
  it('does not silently remove an uncertain digit or given name to manufacture another valid value', () => {
    const text = confidentLicenseText(tsv([
      [['DNI:', 97], ['900123', 97], ['45', 30]],
      [['PEREZ,', 95], ['ANA', 96], ['QA', 20]],
      [['DOCUMENTO,', 98], ['APELLIDO', 95], ['Y', 96], ['NOMBRE', 97]],
    ]));
    expect(licenseFields(text)).toEqual({}); expect(text).toContain('[?]');
  });
  it('omits conflicts across passes and discards medical, emergency and address data', () => {
    const result = mergeLicenseText([
      'DNI: 90012345\nAPELLIDO: QA\nDOMICILIO QA 100\nGRUPO SANGUINEO O+\nEN EMERGENCIA 123456',
      'DNI: 90054321\nNOMBRE: ANA QA\nN° DE CONTROL: 99999999',
    ]);
    expect(licenseFields(result)).toEqual({ apellido: 'QA', nombre: 'ANA QA' });
    expect(result).not.toMatch(/900|GRUPO|DOMICILIO|EMERGENCIA|CONTROL/);
  });
  it('rejects plain garbage, malformed TSV and non-finite confidence rather than trusting a zero exit code', () => {
    expect(() => confidentLicenseText('DNI 90012345')).toThrow('INVALID_OCR_TSV');
    expect(() => confidentLicenseText(header + '\n5\t1')).toThrow('INVALID_OCR_TSV');
    expect(licenseFields(confidentLicenseText(tsv([[['DNI:', 99], ['90012345', Number.NaN]]])))).toEqual({});
    expect(mergeLicenseText(['NADA', 'MINISTERIO DE SEGURIDAD\nB-1 AUTOS HASTA 3500 KGS'])).toBe('');
  });
});

describe('shadow compensation is bounded and never changes input pixels', () => {
  it('separates dark strokes on a locally uneven background, including image boundaries', () => {
    const pixels = Uint8Array.from([200, 200, 200, 200, 30, 200, 200, 200, 200]);
    const before = pixels.slice(), output = adaptiveLicensePixels(pixels, 3, 3);
    expect([...output]).toEqual([255, 255, 255, 255, 0, 255, 255, 255, 255]);
    expect(pixels).toEqual(before); expect(adaptiveLicensePixels(Uint8Array.of(90), 1, 1)).toEqual(Uint8Array.of(255));
  });
  it.each([[0, 1], [1801, 1], [1, 1801], [1.5, 1], [Number.NaN, 1], [2, 2]])('rejects invalid/oversized %s x %s rasters before allocation', (width, height) => {
    expect(() => adaptiveLicensePixels(Uint8Array.of(20), width, height)).toThrow('INVALID_OCR_RASTER');
  });
  it('pins official model bytes and rejects a same-size tampered model', () => {
    expect(LICENSE_MODEL.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/tesseract-ocr\/tessdata_best\/[a-f0-9]{40}\/spa\.traineddata$/);
    expect(() => verifyLicenseModel(Buffer.alloc(0))).toThrow('LICENSE_MODEL_INTEGRITY');
    expect(() => verifyLicenseModel(Buffer.alloc(LICENSE_MODEL.bytes))).toThrow('LICENSE_MODEL_INTEGRITY');
  });
});
