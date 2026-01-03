import crypto from 'crypto';

/**
 * Servicio de Firma Digital Simulada (PKI Demo)
 * En producción, reemplazar por integración con ONTI/PKI real
 */

export interface FirmaDigital {
  hash: string;              // SHA-256 del documento
  firmaBase64: string;       // Firma en Base64
  certificadoSerial: string; // Serial del certificado
  emisor: string;            // Emisor del certificado
  titular: string;           // Titular (firmante)
  validoDesde: string;       // Inicio de validez
  validoHasta: string;       // Fin de validez
  algoritmo: string;         // Algoritmo usado
  timestamp: string;         // Momento de la firma
}

// Certificado demo autogenerado
const CERT_DEMO = {
  serial: 'SITREP-DEMO-2026-001',
  emisor: 'SITREP Demo CA - Ultima Milla',
  algoritmo: 'SHA256withRSA',
  validoDesde: '2026-01-01T00:00:00Z',
  validoHasta: '2027-12-31T23:59:59Z',
};

// Clave privada demo (solo para simulación, NO usar en producción)
const DEMO_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MfszS9Wc8 DEMO KEY
THIS IS A SIMULATED KEY FOR DEMO PURPOSES ONLY
-----END RSA PRIVATE KEY-----`;

export const signatureService = {
  /**
   * Generar firma digital simulada para un documento
   */
  firmar(contenido: string, firmante: { nombre: string; email: string; cuit?: string }): FirmaDigital {
    // 1. Calcular hash del contenido
    const hash = crypto.createHash('sha256').update(contenido).digest('hex');

    // 2. Simular firma (en producción usaría HSM/PKI real)
    const dataToSign = `${hash}|${CERT_DEMO.serial}|${new Date().toISOString()}`;
    const firmaBase64 = crypto
      .createHmac('sha256', 'sitrep-demo-secret-key')
      .update(dataToSign)
      .digest('base64');

    // 3. Construir resultado
    return {
      hash,
      firmaBase64,
      certificadoSerial: CERT_DEMO.serial,
      emisor: CERT_DEMO.emisor,
      titular: `${firmante.nombre} <${firmante.email}>${firmante.cuit ? ` - CUIT: ${firmante.cuit}` : ''}`,
      validoDesde: CERT_DEMO.validoDesde,
      validoHasta: CERT_DEMO.validoHasta,
      algoritmo: CERT_DEMO.algoritmo,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Verificar integridad de un documento firmado
   */
  verificar(contenido: string, firma: FirmaDigital): {
    valido: boolean;
    motivo?: string;
    detalles: {
      hashCoincide: boolean;
      certificadoVigente: boolean;
      timestampValido: boolean;
    };
  } {
    // 1. Verificar hash
    const hashActual = crypto.createHash('sha256').update(contenido).digest('hex');
    const hashCoincide = hashActual === firma.hash;

    // 2. Verificar vigencia del certificado
    const ahora = new Date();
    const validoDesde = new Date(firma.validoDesde);
    const validoHasta = new Date(firma.validoHasta);
    const certificadoVigente = ahora >= validoDesde && ahora <= validoHasta;

    // 3. Verificar timestamp
    const timestampFirma = new Date(firma.timestamp);
    const timestampValido = timestampFirma >= validoDesde && timestampFirma <= validoHasta;

    // 4. Determinar validez global
    const valido = hashCoincide && certificadoVigente && timestampValido;

    let motivo: string | undefined;
    if (!hashCoincide) motivo = 'El documento ha sido modificado después de la firma';
    else if (!certificadoVigente) motivo = 'El certificado ha expirado';
    else if (!timestampValido) motivo = 'El timestamp de firma está fuera del período de validez';

    return {
      valido,
      motivo,
      detalles: {
        hashCoincide,
        certificadoVigente,
        timestampValido,
      },
    };
  },

  /**
   * Generar datos para mostrar en la UI
   */
  formatearParaMostrar(firma: FirmaDigital): {
    firmante: string;
    fecha: string;
    certificado: string;
    estado: 'VÁLIDO' | 'EXPIRADO' | 'INVÁLIDO';
    detalles: string[];
  } {
    const ahora = new Date();
    const validoHasta = new Date(firma.validoHasta);
    const estado = ahora <= validoHasta ? 'VÁLIDO' : 'EXPIRADO';

    return {
      firmante: firma.titular,
      fecha: new Date(firma.timestamp).toLocaleString('es-AR'),
      certificado: `${firma.emisor} (${firma.certificadoSerial})`,
      estado,
      detalles: [
        `Algoritmo: ${firma.algoritmo}`,
        `Hash: ${firma.hash.substring(0, 16)}...`,
        `Válido hasta: ${new Date(firma.validoHasta).toLocaleDateString('es-AR')}`,
      ],
    };
  },

  /**
   * Obtener información del certificado demo
   */
  obtenerInfoCertificado(): typeof CERT_DEMO & { tipo: string } {
    return {
      ...CERT_DEMO,
      tipo: 'DEMO - Simulación de PKI',
    };
  },
};

export default signatureService;
