/**
 * SITREP v6 - Formatters Unit Tests
 * Pure function tests for all exported formatters.
 */

import { describe, it, expect } from 'vitest';
import { EstadoManifiesto, Rol } from '@src/types/models';

// Import all formatters
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  formatWeight,
  formatEstado,
  formatRol,
  formatCuit,
  formatPatente,
  formatManifiestoNumero,
  truncate,
  capitalize,
  initials,
} from '@src/utils/formatters';

describe('formatters - dates', () => {
  describe('formatDate', () => {
    it('should return "-" for null/undefined', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
    });

    it('should format a valid date string', () => {
      const result = formatDate('2025-06-15T10:30:00Z');
      expect(result).toContain('06');
      expect(result).toContain('2025');
    });

    it('should format using es-AR locale (DD/MM/YYYY)', () => {
      // Use a midday UTC time to avoid timezone edge effects
      const result = formatDate('2025-01-05T12:00:00Z');
      // In es-AR: day/month/year with / separator
      expect(result).toContain('01');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('formatDateTime', () => {
    it('should return "-" for null/undefined', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(undefined)).toBe('-');
    });

    it('should include date and time in output', () => {
      const result = formatDateTime('2025-06-15T10:30:00Z');
      expect(result).toContain('06');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{4}/); // year present
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "Ahora" for very recent dates', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('Ahora');
    });

    it('should return min format for < 1 hour', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinAgo)).toBe('Hace 5 min');
    });

    it('should return h format for < 24 hours', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('Hace 2h');
    });

    it('should return d format for < 7 days', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('Hace 3d');
    });
  });
});

describe('formatters - numbers', () => {
  describe('formatNumber', () => {
    it('should return "0" for null/NaN', () => {
      expect(formatNumber(null as unknown as number)).toBe('0');
      expect(formatNumber(undefined as unknown as number)).toBe('0');
      expect(formatNumber(NaN)).toBe('0');
    });

    it('should respect decimals parameter', () => {
      const result = formatNumber(123.456, 2);
      expect(result).toMatch(/123[,.]46/);
    });
  });

  describe('formatCurrency', () => {
    it('should format as ARS currency', () => {
      const result = formatCurrency(1500);
      expect(result).toContain('$');
    });
  });

  describe('formatWeight', () => {
    it('should return "0 kg" for null/NaN', () => {
      expect(formatWeight(null as unknown as number)).toBe('0 kg');
      expect(formatWeight(NaN)).toBe('0 kg');
    });

    it('should format kg values < 1000', () => {
      expect(formatWeight(500)).toBe('500 kg');
    });

    it('should convert to tn for values >= 1000', () => {
      expect(formatWeight(1500)).toMatch(/1[,.]5 tn/);
      expect(formatWeight(2000)).toMatch(/2[,.]0 tn/);
    });
  });
});

describe('formatters - domain', () => {
  describe('formatEstado', () => {
    it('should return label for known estado', () => {
      expect(formatEstado(EstadoManifiesto.BORRADOR)).toBe('Borrador');
      expect(formatEstado(EstadoManifiesto.APROBADO)).toBe('Aprobado');
      expect(formatEstado(EstadoManifiesto.EN_TRANSITO)).toBe('En Tránsito');
      expect(formatEstado(EstadoManifiesto.TRATADO)).toBe('Tratado');
      expect(formatEstado(EstadoManifiesto.CANCELADO)).toBe('Cancelado');
    });

    it('should return raw value for unknown estado', () => {
      expect(formatEstado('UNKNOWN' as EstadoManifiesto)).toBe('UNKNOWN');
    });
  });

  describe('formatRol', () => {
    it('should return label for known rol', () => {
      expect(formatRol(Rol.ADMIN)).toBe('Administrador');
      expect(formatRol(Rol.GENERADOR)).toBe('Generador');
      expect(formatRol(Rol.TRANSPORTISTA)).toBe('Transportista');
      expect(formatRol(Rol.OPERADOR)).toBe('Operador');
    });

    it('should return raw value for unknown rol', () => {
      expect(formatRol('AUDITOR' as Rol)).toBe('AUDITOR');
    });
  });

  describe('formatCuit', () => {
    it('should return "-" for empty input', () => {
      expect(formatCuit('')).toBe('-');
    });

    it('should return raw value for non-11-digit input', () => {
      expect(formatCuit('123')).toBe('123');
    });

    it('should format 11-digit CUIT with dashes', () => {
      expect(formatCuit('20123456789')).toBe('20-12345678-9');
    });
  });

  describe('formatPatente', () => {
    it('should return "-" for empty input', () => {
      expect(formatPatente('')).toBe('-');
    });

    it('should format 7-char patente (modern format)', () => {
      const result = formatPatente('AB123CD');
      expect(result).toBe('AB 123 CD');
    });

    it('should format 6-char patente (old format)', () => {
      const result = formatPatente('ABC123');
      expect(result).toBe('ABC 123');
    });
  });

  describe('formatManifiestoNumero', () => {
    it('should add M- prefix if missing', () => {
      expect(formatManifiestoNumero('12345')).toBe('M-12345');
    });

    it('should not duplicate M- prefix', () => {
      expect(formatManifiestoNumero('M-12345')).toBe('M-12345');
    });
  });
});

describe('formatters - text', () => {
  describe('truncate', () => {
    it('should return "" for empty input', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('should return full text if within maxLen', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should truncate with ... if text exceeds maxLen', () => {
      // truncate uses slice(0, maxLen - 3) + '...'
      // For maxLen=10: slice(0, 7) + '...'
      const result = truncate('Hello World This Is Long', 10);
      expect(result).toHaveLength(10);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('capitalize', () => {
    it('should return "" for empty input', () => {
      expect(capitalize('')).toBe('');
    });

    it('should capitalize first letter and lowercase rest', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('hELLO WORLD')).toBe('Hello world');
    });
  });

  describe('initials', () => {
    it('should return initials from nombre only', () => {
      expect(initials('Juan')).toBe('J');
    });

    it('should return initials from nombre and apellido', () => {
      expect(initials('Juan', 'Perez')).toBe('JP');
    });

    it('should return uppercase initials', () => {
      expect(initials('juan', 'perez')).toBe('JP');
    });
  });
});
