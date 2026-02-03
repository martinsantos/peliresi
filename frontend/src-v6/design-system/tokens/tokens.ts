/**
 * SITREP Design System v6 - Tokens Consolidados
 * =============================================
 * Todos los tokens en un solo objeto para configuraciones
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { animation } from './animations';

export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  animation,
} as const;

export default tokens;
