import { expect, it } from 'vitest';
import { supportStates } from '../../types/support';
it('names the actual waiting party instead of falsely asking the technician to respond', () => {
  expect(supportStates.ESPERANDO_USUARIO).toBe('Esperando al usuario');
});
