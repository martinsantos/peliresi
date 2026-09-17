import { describe, expect, it } from 'vitest';
import { buildStructuredOcrData, extractDocumentOcrFields } from '../../utils/documentOcr';

describe('document OCR structured suggestions', () => {
  it('recognizes license fields without auto-approving them', () => {
    const result = buildStructuredOcrData({
      tipo: 'LICENCIA_CONDUCIR',
      text: 'LICENCIA NACIONAL DE CONDUCIR\nAPELLIDO: PEREZ\nNOMBRE: JUAN\nDNI: 20.123.456\nCLASE: E1\nVENCIMIENTO: 31/12/2027',
      language: 'spa',
      engine: 'fixture',
    });
    expect(result.tipoDetectado).toBe('LICENCIA_CONDUCIR');
    expect(result.revision).toBe('PENDIENTE_CONFIRMACION');
    expect(result.campos).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'dni', value: '20123456' }),
      expect.objectContaining({ key: 'clase', value: 'E1' }),
      expect.objectContaining({ key: 'vencimiento', value: '31/12/2027' }),
    ]));
  });

  it('recognizes a blue card vehicle domain', () => {
    const fields = extractDocumentOcrFields('TARJETA_IDENTIFICACION_VEHICULO', 'CEDULA AZUL\nDOMINIO: AB123CD\nTITULAR: JUAN PEREZ');
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'patente', value: 'AB123CD' }),
      expect.objectContaining({ key: 'titular', value: 'JUAN PEREZ' }),
    ]));
  });
});
