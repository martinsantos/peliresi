import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from '../../utils/passwordStrength';

describe('validatePasswordStrength', () => {
  it('returns error for empty string', () => {
    expect(validatePasswordStrength('')).toBe('La contraseña debe tener al menos 10 caracteres');
  });

  it('returns error for too short (8 chars, no lowercase, no special)', () => {
    expect(validatePasswordStrength('Aa1')).toBe('La contraseña debe tener al menos 10 caracteres');
  });

  it('returns error for exactly 9 chars (still too short)', () => {
    expect(validatePasswordStrength('Abc12345')).toBe('La contraseña debe tener al menos 10 caracteres');
  });

  it('returns error when missing uppercase', () => {
    expect(validatePasswordStrength('abcdef1234!')).toBe('La contraseña debe contener al menos una mayúscula');
  });

  it('returns error when missing lowercase', () => {
    expect(validatePasswordStrength('ABCDEF1234!')).toBe('La contraseña debe contener al menos una minúscula');
  });

  it('returns error when missing digit', () => {
    expect(validatePasswordStrength('Abcdefghij!')).toBe('La contraseña debe contener al menos un número');
  });

  it('returns error when missing special character', () => {
    expect(validatePasswordStrength('Abcdefghij1')).toBe('La contraseña debe contener al menos un carácter especial');
  });

  it('returns null for valid password', () => {
    expect(validatePasswordStrength('Abcdefgh1!')).toBeNull();
  });

  it('accepts password with multiple special characters', () => {
    expect(validatePasswordStrength('Str0ng!Pass#Word')).toBeNull();
  });

  it('accepts password with spaces (special char)', () => {
    expect(validatePasswordStrength('Mi Password 123')).toBeNull();
  });

  it('accepts password with exactly 10 chars', () => {
    expect(validatePasswordStrength('Abc123!xyz')).toBeNull();
  });

  it('accepts very long password', () => {
    const long = 'A1!' + 'x'.repeat(100);
    expect(validatePasswordStrength(long)).toBeNull();
  });
});
