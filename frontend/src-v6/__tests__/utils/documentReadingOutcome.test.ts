import { describe, expect, it } from 'vitest';
import { documentReadingOutcome } from '../../utils/documentReadingOutcome';
import type { ReceiptAnalysis } from '../../types/documentAnalysis';

const read: ReceiptAnalysis = {version:1,lectura:'LEIDO',texto:'QA',duplicado:false,motor:'PDF_TEXT',alcance:'Prueba',aviso:null};
describe('reading completion is not administrative approval', () => {
  it.each([undefined, null, {...read,lectura:'NO_DISPONIBLE' as const}])('does not call an unavailable result completed', result => {
    expect(documentReadingOutcome(result)).toContain('No se pudo completar');
  });
  it.each([{...read,lectura:'SIN_TEXTO' as const},{...read,texto:'  '}])('names illegible results', result => {
    expect(documentReadingOutcome(result)).toContain('sin texto legible');
  });
  it('requires manual review even after successful extraction', () => {
    expect(documentReadingOutcome(read)).toContain('el documento no se aprobó');
  });
  it('does not hide a complementary reading failure behind retained text', () => {
    expect(documentReadingOutcome({...read,aviso:'No se pudo completar el segundo intento.'})).toContain('con observaciones');
  });
});
