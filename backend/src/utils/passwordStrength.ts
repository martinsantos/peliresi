/**
 * Validates password strength and returns an error message or null if valid.
 *
 * Rules:
 *  - Minimum 10 characters
 *  - At least 1 uppercase letter
 *  - At least 1 lowercase letter
 *  - At least 1 digit
 *  - At least 1 special character (!@#$%^&*()_+\-=\[\]{}|;':\",./<>?~` )
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula';
  if (!/[a-z]/.test(password)) return 'La contraseña debe contener al menos una minúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número';
  if (!/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?~` ]/.test(password)) return 'La contraseña debe contener al menos un carácter especial';
  return null;
}
