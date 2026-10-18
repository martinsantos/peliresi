import {
  getMissingRequiredDocumentTypes,
  getSolicitudRequirements,
  SOLICITUD_DOCUMENT_MAX_BYTES,
} from '../../services/solicitudRequirements.service';

describe('solicitudRequirements', () => {
  it('exposes a canonical, defensive copy per actor type', () => {
    const first = getSolicitudRequirements('GENERADOR');
    expect(first.map((item) => item.tipo)).toEqual([
      'CONSTANCIA_AFIP',
      'MEMORIA_TECNICA',
      'CERTIFICADO_HABILITACION',
      'COMPROBANTE_PAGO',
    ]);
    first[0].nombre = 'mutated';
    expect(getSolicitudRequirements('GENERADOR')[0].nombre).toBe('Constancia AFIP');
    expect(SOLICITUD_DOCUMENT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it('never makes a receipt a new legal requirement', () => {
    for (const actor of ['GENERADOR', 'OPERADOR', 'TRANSPORTISTA']) {
      expect(getSolicitudRequirements(actor).find(doc => doc.tipo === 'COMPROBANTE_PAGO')?.required).toBe(false);
    }
  });

  it('returns only required documents that are still missing', () => {
    expect(getMissingRequiredDocumentTypes('TRANSPORTISTA', ['CONSTANCIA_AFIP'])).toEqual([
      'CERTIFICADO_HABILITACION',
      'SEGURO_AMBIENTAL',
    ]);
  });

  it('rejects unknown actor types without inventing requirements', () => {
    expect(getSolicitudRequirements('UNKNOWN')).toEqual([]);
  });
});
