/**
 * Tests for src-v6/utils/formatters.ts
 * Pure utility functions — no React needed
 */
import { describe, it, expect } from 'vitest';

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
} from '../../utils/formatters';
import { EstadoManifiesto, Rol } from '../../types/models';

// ========================================
// Date formatters
// ========================================

describe('formatDate()', () => {
  it('returns "-" for null/undefined', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });

  it('formats a valid ISO date string to dd/mm/yyyy (es-AR locale)', () => {
    const result = formatDate('2026-01-15T10:00:00.000Z');
    // es-AR locale: dd/mm/yyyy — exact format depends on Node ICU
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatDateTime()', () => {
  it('returns "-" for null/undefined', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('includes time component', () => {
    const result = formatDateTime('2026-03-20T14:30:00.000Z');
    expect(result).toMatch(/2026/);
    // Should contain some time component
    expect(result.length).toBeGreaterThan(10);
  });
});

describe('formatRelativeTime()', () => {
  it('returns "Ahora" for very recent timestamps', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Ahora');
  });

  it('returns "Hace X min" for timestamps within the last hour', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('Hace 5 min');
  });

  it('returns "Hace Xh" for timestamps within the last day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('Hace 3h');
  });

  it('returns "Hace Xd" for timestamps within the last week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('Hace 2d');
  });

  it('falls back to formatDate for timestamps older than a week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
    const result = formatRelativeTime(twoWeeksAgo);
    // Should look like a date, not a relative string
    expect(result).not.toMatch(/^Hace/);
    expect(result).toMatch(/\d/);
  });
});

// ========================================
// Number formatters
// ========================================

describe('formatNumber()', () => {
  it('formats integers with no decimals by default', () => {
    const result = formatNumber(1234);
    // es-AR uses dot as thousands separator
    expect(result).toMatch(/1.*234/);
  });

  it('handles 0', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('returns "0" for NaN', () => {
    expect(formatNumber(NaN)).toBe('0');
  });

  it('respects decimal parameter', () => {
    const result = formatNumber(3.14159, 2);
    expect(result).toMatch(/3.*14/);
  });
});

describe('formatCurrency()', () => {
  it('formats as ARS currency', () => {
    const result = formatCurrency(1500);
    // Should contain $ and number
    expect(result).toMatch(/\$/);
    expect(result).toMatch(/1.*500/);
  });
});

describe('formatWeight()', () => {
  it('formats kg under 1000', () => {
    expect(formatWeight(500)).toMatch(/500.*kg/);
  });

  it('converts to tn for >= 1000kg', () => {
    const result = formatWeight(2500);
    expect(result).toMatch(/2.*5.*tn/);
  });

  it('returns "0 kg" for NaN', () => {
    expect(formatWeight(NaN)).toBe('0 kg');
  });
});

// ========================================
// Domain formatters
// ========================================

describe('formatEstado()', () => {
  it('maps BORRADOR to Borrador', () => {
    expect(formatEstado(EstadoManifiesto.BORRADOR)).toBe('Borrador');
  });

  it('maps EN_TRANSITO to "En Transito"', () => {
    expect(formatEstado(EstadoManifiesto.EN_TRANSITO)).toMatch(/En Tr.nsito/);
  });

  it('maps TRATADO to Tratado', () => {
    expect(formatEstado(EstadoManifiesto.TRATADO)).toBe('Tratado');
  });
});

describe('formatRol()', () => {
  it('maps ADMIN to Administrador', () => {
    expect(formatRol(Rol.ADMIN)).toBe('Administrador');
  });

  it('maps GENERADOR to Generador', () => {
    expect(formatRol(Rol.GENERADOR)).toBe('Generador');
  });
});

describe('formatCuit()', () => {
  it('formats 11-digit CUIT with dashes', () => {
    expect(formatCuit('20123456789')).toBe('20-12345678-9');
  });

  it('returns "-" for empty/null input', () => {
    expect(formatCuit('')).toBe('-');
  });

  it('returns input as-is for non-11-digit strings', () => {
    expect(formatCuit('123')).toBe('123');
  });
});

describe('formatPatente()', () => {
  it('returns "-" for empty', () => {
    expect(formatPatente('')).toBe('-');
  });

  it('formats new 7-char plates (AA 123 BB)', () => {
    expect(formatPatente('AB123CD')).toBe('AB 123 CD');
  });

  it('formats old 6-char plates (ABC 123)', () => {
    expect(formatPatente('ABC123')).toBe('ABC 123');
  });
});

describe('formatManifiestoNumero()', () => {
  it('adds M- prefix if not present', () => {
    expect(formatManifiestoNumero('00001')).toBe('M-00001');
  });

  it('leaves M- prefix alone if already present', () => {
    expect(formatManifiestoNumero('M-00001')).toBe('M-00001');
  });
});

// ========================================
// Text formatters
// ========================================

describe('truncate()', () => {
  it('returns full text if shorter than maxLen', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    expect(truncate('hello world foo', 10)).toBe('hello w...');
  });

  it('returns empty string for empty input', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('capitalize()', () => {
  it('capitalizes first letter, lowercases rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('initials()', () => {
  it('returns first letters of nombre and apellido', () => {
    expect(initials('Juan', 'Perez')).toBe('JP');
  });

  it('handles missing apellido', () => {
    expect(initials('Maria')).toBe('M');
  });

  it('handles null apellido', () => {
    expect(initials('Maria', null)).toBe('M');
  });
});
