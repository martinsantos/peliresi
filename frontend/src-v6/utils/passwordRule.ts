// Mirrors validatePasswordStrength in backend/src/controllers/auth.controller.ts (same order and wording).
// The server still decides; this only avoids a round trip that is certain to fail.
export function passwordRuleError(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número';
  return null;
}
